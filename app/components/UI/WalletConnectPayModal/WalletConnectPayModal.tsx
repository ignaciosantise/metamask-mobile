import React, { useCallback } from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import Text, { TextVariant } from '../../../component-library/components/Texts/Text';
import ButtonIcon from '../../../component-library/components/Buttons/ButtonIcon';
import {
  IconName,
  IconColor,
} from '../../../component-library/components/Icons/Icon';
import { useStyles } from '../../../component-library/hooks';
import { useParams } from '../../../util/navigation/navUtils';

import styleSheet from './WalletConnectPayModal.styles';
import { usePaymentFlow } from './usePaymentFlow';
import LoadingView from './LoadingView';
import ConfirmView from './ConfirmView';
import CollectDataWebView from './CollectDataWebView';
import ResultView from './ResultView';

interface WalletConnectPayModalParams {
  paymentUrl: string;
}

const WalletConnectPayModal = () => {
  const { styles } = useStyles(styleSheet, {});
  const navigation = useNavigation();
  const params = useParams<WalletConnectPayModalParams>();

  const flow = usePaymentFlow(params.paymentUrl);

  const onClose = useCallback(() => {
    flow.reset();
    navigation.goBack();
  }, [flow, navigation]);

  const goBack = useCallback(() => {
    if (flow.state.step === 'collectData') {
      flow.setStep('confirm');
    } else {
      onClose();
    }
  }, [flow.state.step, flow, onClose]);

  const renderContent = () => {
    switch (flow.state.step) {
      case 'loading':
        return <LoadingView message="Preparing your payment..." />;
      case 'collectData':
        return <CollectDataWebView flow={flow} />;
      case 'confirm':
        return <ConfirmView flow={flow} />;
      case 'confirming':
        return <LoadingView message="Confirming your payment..." />;
      case 'result':
        return <ResultView flow={flow} onClose={onClose} />;
      default:
        return <LoadingView message="Loading..." />;
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerButton}>
          {flow.state.step === 'collectData' && (
            <ButtonIcon
              onPress={goBack}
              iconName={IconName.ArrowLeft}
              iconColor={IconColor.Default}
            />
          )}
        </View>
        <Text variant={TextVariant.HeadingMD} style={styles.headerTitle}>
          WalletConnect Pay
        </Text>
        <View style={styles.headerButton}>
          <ButtonIcon
            onPress={onClose}
            iconName={IconName.Close}
            iconColor={IconColor.Default}
          />
        </View>
      </View>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderContent()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default WalletConnectPayModal;
