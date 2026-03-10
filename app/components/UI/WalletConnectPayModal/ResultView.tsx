import React from 'react';
import { View } from 'react-native';

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
import { getErrorTitle } from './utils';
import type { PaymentFlow } from './usePaymentFlow';

interface ResultViewProps {
  flow: PaymentFlow;
  onClose: () => void;
}

const ResultView = ({ flow, onClose }: ResultViewProps) => {
  const { styles } = useStyles(styleSheet, {});
  const { resultStatus, resultMessage, resultErrorType } = flow.state;

  const isSuccess = resultStatus === 'success';
  const title = isSuccess
    ? resultMessage
    : resultErrorType
      ? getErrorTitle(resultErrorType)
      : resultMessage;

  return (
    <View style={styles.resultContainer}>
      <View style={styles.resultIcon}>
        <Text variant={TextVariant.DisplayMD}>{isSuccess ? '✓' : '✕'}</Text>
      </View>
      <Text variant={TextVariant.HeadingLG} style={styles.resultTitle}>
        {title}
      </Text>
      {!isSuccess && resultErrorType && (
        <Text
          variant={TextVariant.BodyMD}
          color={TextColor.Alternative}
          style={styles.resultMessage}
          numberOfLines={3}
        >
          {resultMessage}
        </Text>
      )}
      <Button
        variant={ButtonVariants.Primary}
        size={ButtonSize.Lg}
        width={ButtonWidthTypes.Full}
        label={isSuccess ? 'Got it!' : 'Close'}
        onPress={onClose}
        style={styles.primaryButton}
      />
    </View>
  );
};

export default ResultView;
