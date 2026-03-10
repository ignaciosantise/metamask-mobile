import React from 'react';
import { View, ScrollView, TouchableOpacity, Image } from 'react-native';

import Text, {
  TextVariant,
  TextColor,
} from '../../../component-library/components/Texts/Text';
import Button, {
  ButtonVariants,
  ButtonWidthTypes,
  ButtonSize,
} from '../../../component-library/components/Buttons/Button';
import { useStyles } from '../../../component-library/hooks';

import styleSheet from './WalletConnectPayModal.styles';
import { formatAmount } from './utils';
import type { PaymentFlow } from './usePaymentFlow';
import type { PaymentOption } from '@walletconnect/pay';

const MAX_VISIBLE_OPTIONS = 4;
const OPTION_HEIGHT = 64;
const OPTION_GAP = 8;

interface ConfirmViewProps {
  flow: PaymentFlow;
}

const ConfirmView = ({ flow }: ConfirmViewProps) => {
  const { styles, theme } = useStyles(styleSheet, {});
  const { state, selectOption, handleConfirmOrNext } = flow;
  const { paymentData, selectedOption, collectDataCompletedIds } = state;

  const options = paymentData?.options || [];

  const selectedCompleted =
    selectedOption && collectDataCompletedIds.includes(selectedOption.id);
  const visibleOptions = selectedCompleted
    ? options.filter((o) => o.id === selectedOption?.id)
    : options;

  const scrollable = visibleOptions.length > MAX_VISIBLE_OPTIONS;
  const listMaxHeight =
    MAX_VISIBLE_OPTIONS * OPTION_HEIGHT + (MAX_VISIBLE_OPTIONS - 1) * OPTION_GAP;

  const selectedNeedsCollectData = !!(
    selectedOption &&
    (selectedOption as PaymentOption).collectData?.url &&
    !collectDataCompletedIds.includes(selectedOption.id)
  );

  // ── Merchant info ──

  const renderMerchantInfo = () => {
    if (!paymentData?.info) return null;

    const { merchant, amount } = paymentData.info;
    const displayAmount = amount
      ? formatAmount(amount.value, amount.display?.decimals || 0, 2)
      : null;
    const currencySymbol = amount?.display?.assetSymbol || '';

    return (
      <View style={styles.merchantContainer}>
        {merchant?.iconUrl ? (
          <Image
            source={{ uri: merchant.iconUrl }}
            style={styles.merchantIcon}
          />
        ) : (
          <View style={styles.merchantIconPlaceholder}>
            <Text variant={TextVariant.HeadingLG}>
              {merchant?.name?.charAt(0) || '?'}
            </Text>
          </View>
        )}
        {merchant?.name && displayAmount && (
          <Text variant={TextVariant.HeadingMD} style={styles.merchantPayText}>
            Pay {currencySymbol}
            {displayAmount} to {merchant.name}
          </Text>
        )}
      </View>
    );
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderMerchantInfo()}
        {state.actionsError && (
          <View style={styles.errorBanner}>
            <Text variant={TextVariant.BodyMD} style={styles.errorText}>
              {state.actionsError}
            </Text>
          </View>
        )}
        <ScrollView
          style={[
            styles.optionsList,
            scrollable ? { maxHeight: listMaxHeight } : undefined,
          ]}
          contentContainerStyle={styles.optionsListContent}
          showsVerticalScrollIndicator={scrollable}
          nestedScrollEnabled
        >
          {visibleOptions.map((option) => {
            const isSelected = selectedOption?.id === option.id;
            const amount = formatAmount(
              option.amount.value,
              option.amount.display.decimals,
              2,
            );
            const hasCollectData =
              !!(option as PaymentOption).collectData?.url &&
              !collectDataCompletedIds.includes(option.id);
            const networkIconUrl = option.amount.display.networkIconUrl;

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => selectOption(option)}
              >
                <View style={styles.optionIconContainer}>
                  {option.amount.display.iconUrl && (
                    <Image
                      source={{ uri: option.amount.display.iconUrl }}
                      style={styles.optionIcon}
                    />
                  )}
                  {networkIconUrl && (
                    <Image
                      source={{ uri: networkIconUrl }}
                      style={[
                        styles.optionChainIcon,
                        {
                          borderColor: isSelected
                            ? theme.colors.primary.muted
                            : theme.colors.background.alternative,
                        },
                      ]}
                    />
                  )}
                </View>
                <Text
                  variant={TextVariant.BodyMD}
                  style={styles.optionTextContainer}
                >
                  {amount} {option.amount.display.assetSymbol}
                </Text>
                {hasCollectData && (
                  <View style={styles.collectDataPill}>
                    <Text
                      variant={TextVariant.BodySM}
                      color={TextColor.Warning}
                    >
                      Info required
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          variant={ButtonVariants.Primary}
          size={ButtonSize.Lg}
          width={ButtonWidthTypes.Full}
          label={
            selectedNeedsCollectData
              ? 'Next'
              : `Pay ${paymentData?.info?.amount?.display?.assetSymbol || ''} ${formatAmount(paymentData?.info?.amount?.value || '0', paymentData?.info?.amount?.display?.decimals || 0, 2)}`
          }
          onPress={handleConfirmOrNext}
          disabled={
            !selectedOption ||
            state.isLoadingActions ||
            !state.paymentActions ||
            state.paymentActions.length === 0
          }
          loading={state.isLoadingActions}
          style={styles.primaryButton}
        />
      </View>
    </>
  );
};

export default ConfirmView;
