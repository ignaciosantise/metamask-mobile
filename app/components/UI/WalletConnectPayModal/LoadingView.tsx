import React from 'react';
import { View, ActivityIndicator } from 'react-native';

import Text, {
  TextVariant,
  TextColor,
} from '../../../component-library/components/Texts/Text';
import { useStyles } from '../../../component-library/hooks';

import styleSheet from './WalletConnectPayModal.styles';

interface LoadingViewProps {
  message: string;
}

const LoadingView = ({ message }: LoadingViewProps) => {
  const { styles, theme } = useStyles(styleSheet, {});

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary.default} />
      <Text
        variant={TextVariant.BodyMD}
        color={TextColor.Alternative}
        style={styles.loadingText}
      >
        {message}
      </Text>
    </View>
  );
};

export default LoadingView;
