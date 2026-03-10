import { useState, useEffect, useCallback, useRef } from 'react';
import {
  KeyringController,
  SignTypedDataVersion,
} from '@metamask/keyring-controller';
import { AccountsController } from '@metamask/accounts-controller';
import { WalletConnectPay } from '@walletconnect/pay';
import type {
  PaymentOption,
  Action,
  PaymentOptionsResponse,
} from '@walletconnect/pay';

import WC2Manager from '../../../core/WalletConnect/WalletConnectV2';
import Engine from '../../../core/Engine';
import Logger from '../../../util/Logger';

import {
  formatAmount,
  detectErrorType,
  getErrorMessage,
} from './utils';

// ── Types ──────────────────────────────────────────────────────────────

export type ModalStep =
  | 'loading'
  | 'collectData'
  | 'confirm'
  | 'confirming'
  | 'result';

export type ResultStatus = 'success' | 'error';

export type ErrorType =
  | 'insufficient_funds'
  | 'expired'
  | 'cancelled'
  | 'not_found'
  | 'generic';

export interface PaymentFlowState {
  step: ModalStep;
  resultStatus: ResultStatus;
  resultMessage: string;
  resultErrorType: ErrorType | null;
  selectedOption: PaymentOption | null;
  paymentData: PaymentOptionsResponse | null;
  paymentActions: Action[] | null;
  isLoadingActions: boolean;
  actionsError: string | null;
  collectDataCompletedIds: string[];
}

export interface PaymentFlow {
  state: PaymentFlowState;
  selectOption: (option: PaymentOption) => void;
  markCollectDataCompleted: (optionId: string) => void;
  setStep: (step: ModalStep) => void;
  setError: (message: string) => void;
  reset: () => void;
  handleConfirmOrNext: () => void;
  approvePayment: () => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────────

const initialState: PaymentFlowState = {
  step: 'loading',
  resultStatus: 'success',
  resultMessage: '',
  resultErrorType: null,
  selectedOption: null,
  paymentData: null,
  paymentActions: null,
  isLoadingActions: false,
  actionsError: null,
  collectDataCompletedIds: [],
};

type PayClient = InstanceType<typeof WalletConnectPay>;

async function getPayClient(): Promise<PayClient | null> {
  const wc2Manager = await WC2Manager.getInstance();
  const walletKit = wc2Manager.getWalletKit();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (walletKit as any)?.pay as PayClient | null;
}

function setResult(
  update: (partial: Partial<PaymentFlowState>) => void,
  status: ResultStatus,
  message: string,
  errorType?: ErrorType,
) {
  update({
    resultStatus: status,
    resultMessage: message,
    resultErrorType: errorType ?? null,
    step: 'result',
  });
}

// ── Hook ───────────────────────────────────────────────────────────────

export function usePaymentFlow(paymentUrl: string): PaymentFlow {
  const [state, setState] = useState<PaymentFlowState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const update = useCallback(
    (partial: Partial<PaymentFlowState>) =>
      setState((prev) => ({ ...prev, ...partial })),
    [],
  );

  // ── Fetch payment actions for a given option ──

  const fetchPaymentActions = useCallback(
    async (option: PaymentOption, paymentData: PaymentOptionsResponse) => {
      try {
        const payClient = await getPayClient();

        if (!payClient) {
          update({ actionsError: 'Pay SDK not initialized' });
          return;
        }

        update({ isLoadingActions: true, actionsError: null });

        const actions = await payClient.getRequiredPaymentActions({
          paymentId: paymentData.paymentId,
          optionId: option.id,
        });

        update({ paymentActions: actions as Action[], isLoadingActions: false });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to get payment actions';
        const errorType = detectErrorType(errorMessage);
        setResult(update, 'error', getErrorMessage(errorType, errorMessage), errorType);
        update({ isLoadingActions: false });
      }
    },
    [update],
  );

  // ── Select an option (and fetch its actions) ──

  const selectOption = useCallback(
    (option: PaymentOption) => {
      update({ selectedOption: option });
      const { paymentData } = stateRef.current;
      if (paymentData) {
        fetchPaymentActions(option, paymentData);
      }
    },
    [update, fetchPaymentActions],
  );

  // ── Fetch payment options on mount ──

  useEffect(() => {
    const fetchPaymentOptions = async () => {
      try {
        const payClient = await getPayClient();

        if (!payClient) {
          setResult(update, 'error', 'WalletConnect Pay is not available', 'generic');
          return;
        }

        const accountsController = Engine.context
          .AccountsController as AccountsController;
        const selectedAccount = accountsController.getSelectedAccount();
        const walletAddress = selectedAccount?.address;

        if (!walletAddress) {
          setResult(
            update,
            'error',
            'No wallet address found. Please select an account.',
            'generic',
          );
          return;
        }

        const chainIds = Object.keys(
          Engine.context.NetworkController.state
            .networkConfigurationsByChainId ?? {},
        );
        const accounts = chainIds.map(
          (chainId) => `eip155:${parseInt(chainId, 16)}:${walletAddress}`,
        );

        const options = await payClient.getPaymentOptions({
          paymentLink: paymentUrl,
          accounts,
          includePaymentInfo: true,
        });

        if (!options.options || options.options.length === 0) {
          update({ paymentData: options });
          setResult(
            update,
            'error',
            getErrorMessage('insufficient_funds'),
            'insufficient_funds',
          );
        } else {
          update({ paymentData: options, step: 'confirm' });
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to fetch payment options';
        Logger.error(error as Error, 'WalletConnectPayModal: fetch error');
        const errorType = detectErrorType(errorMessage);
        setResult(update, 'error', getErrorMessage(errorType, errorMessage), errorType);
      }
    };

    fetchPaymentOptions();
  }, [paymentUrl, update]);

  // ── Auto-select first option when entering confirm step ──

  useEffect(() => {
    if (state.step === 'confirm' && !state.selectedOption) {
      const options = state.paymentData?.options || [];
      if (options.length > 0) {
        selectOption(options[0]);
      }
    }
  }, [state.step, state.paymentData?.options, state.selectedOption, selectOption]);

  // ── Actions ──

  const markCollectDataCompleted = useCallback(
    (optionId: string) => {
      setState((prev) => ({
        ...prev,
        collectDataCompletedIds: prev.collectDataCompletedIds.includes(optionId)
          ? prev.collectDataCompletedIds
          : [...prev.collectDataCompletedIds, optionId],
      }));
    },
    [],
  );

  const setStep = useCallback(
    (step: ModalStep) => update({ step }),
    [update],
  );

  const reset = useCallback(() => setState(initialState), []);

  const setError = useCallback(
    (message: string) => {
      const errorType = detectErrorType(message);
      setResult(update, 'error', getErrorMessage(errorType, message), errorType);
    },
    [update],
  );

  const approvePayment = useCallback(async () => {
    const s = stateRef.current;

    if (s.step === 'confirming') return;
    if (!s.paymentActions?.length || !s.selectedOption || !s.paymentData) return;

    update({ step: 'confirming', actionsError: null });

    try {
      const payClient = await getPayClient();
      if (!payClient) throw new Error('Pay SDK not available');

      const keyringController = Engine.context
        .KeyringController as KeyringController;
      const accountsController = Engine.context
        .AccountsController as AccountsController;

      const selectedAccount = accountsController.getSelectedAccount();
      const walletAddress = selectedAccount?.address;
      if (!walletAddress) throw new Error('No wallet address found');

      const signatures: string[] = [];

      for (const action of s.paymentActions) {
        const { walletRpc } = action;
        if (walletRpc) {
          const { method, params: rpcParams } = walletRpc;
          const parsedParams = JSON.parse(rpcParams);

          if (
            method === 'eth_signTypedData_v4' ||
            method === 'eth_signTypedData_v3' ||
            method === 'eth_signTypedData'
          ) {
            const typedData = parsedParams[1];
            const signature = await keyringController.signTypedMessage(
              { from: walletAddress, data: typedData },
              SignTypedDataVersion.V4,
            );
            signatures.push(signature);
          } else {
            throw new Error(`Unsupported signature method: ${method}`);
          }
        }
      }

      const confirmResult = await payClient.confirmPayment({
        paymentId: s.paymentData.paymentId,
        optionId: s.selectedOption.id,
        signatures,
      });

      if (!confirmResult) {
        throw new Error('Payment confirmation failed - no response received');
      }

      if (
        confirmResult.status === 'expired' ||
        confirmResult.status === 'cancelled' ||
        confirmResult.status === 'failed'
      ) {
        const errorType =
          confirmResult.status === 'expired'
            ? 'expired'
            : confirmResult.status === 'cancelled'
              ? 'cancelled'
              : 'generic';
        setResult(update, 'error', getErrorMessage(errorType), errorType);
        return;
      }

      const amount = formatAmount(
        s.selectedOption.amount.value,
        s.selectedOption.amount.display.decimals,
        2,
      );
      setResult(
        update,
        'success',
        `You've paid ${amount} ${s.selectedOption.amount.display.assetSymbol} to ${s.paymentData.info?.merchant?.name || 'the merchant'}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to sign payment';
      Logger.error(error as Error, 'WalletConnectPayModal: sign error');
      const errorType = detectErrorType(errorMessage);
      setResult(update, 'error', getErrorMessage(errorType, errorMessage), errorType);
    }
  }, [update]);

  const handleConfirmOrNext = useCallback(() => {
    const { selectedOption, collectDataCompletedIds } = stateRef.current;
    if (!selectedOption) return;

    const needsCollectData = !!(selectedOption as PaymentOption).collectData?.url;
    const alreadyCompleted = collectDataCompletedIds.includes(selectedOption.id);

    if (needsCollectData && !alreadyCompleted) {
      update({ step: 'collectData' });
    } else {
      approvePayment();
    }
  }, [update, approvePayment]);

  return {
    state,
    selectOption,
    markCollectDataCompleted,
    setStep,
    setError,
    reset,
    handleConfirmOrNext,
    approvePayment,
  };
}
