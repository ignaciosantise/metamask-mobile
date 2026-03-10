import React, { useCallback, useMemo, useState } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
import {
  WebView,
  type WebViewNavigation,
} from '@metamask/react-native-webview';

import { useStyles } from '../../../component-library/hooks';
import Logger from '../../../util/Logger';

import styleSheet from './WalletConnectPayModal.styles';
import type { PaymentFlow } from './usePaymentFlow';
import type { PaymentOption } from '@walletconnect/pay';

const FIT_CONTENT_JS = `
  (function() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=yes';
    document.body.style.overflow = 'hidden';
  })();
  true;
`;

function getBaseUrl(urlString: string): string {
  try {
    const urlObj = new URL(urlString);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return urlString;
  }
}

interface CollectDataWebViewProps {
  flow: PaymentFlow;
}

const CollectDataWebView = ({ flow }: CollectDataWebViewProps) => {
  const { styles, theme } = useStyles(styleSheet, {});
  const [loading, setLoading] = useState(true);

  const collectDataUrl =
    (flow.state.selectedOption as PaymentOption | null)?.collectData?.url || '';

  const baseUrl = useMemo(() => getBaseUrl(collectDataUrl), [collectDataUrl]);

  const handleComplete = useCallback(() => {
    if (flow.state.selectedOption) {
      flow.markCollectDataCompleted(flow.state.selectedOption.id);
    }
    flow.setStep('confirm');
  }, [flow]);

  const handleError = useCallback(
    (errorStr: string) => {
      flow.setError(errorStr);
    },
    [flow],
  );

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as {
          type: 'IC_COMPLETE' | 'IC_ERROR';
          success: boolean;
          error?: string;
        };

        if (message.type === 'IC_COMPLETE' && message.success) {
          handleComplete();
        } else if (message.type === 'IC_ERROR' || !message.success) {
          handleError(message.error || 'Form submission failed');
        }
      } catch {
        // Non-JSON message, ignore
      }
    },
    [handleComplete, handleError],
  );

  const handleShouldStartLoad = useCallback(
    (request: { url: string }) => {
      if (request.url.startsWith('about:blank')) return true;

      const requestBaseUrl = getBaseUrl(request.url);
      if (requestBaseUrl !== baseUrl) {
        Linking.openURL(request.url);
        return false;
      }
      return true;
    },
    [baseUrl],
  );

  if (!collectDataUrl) return null;

  return (
    <View style={styles.webViewContainer}>
      {loading && (
        <View style={styles.webViewLoadingOverlay}>
          <ActivityIndicator
            size="large"
            color={theme.colors.primary.default}
          />
        </View>
      )}
      <WebView
        source={{ uri: collectDataUrl }}
        originWhitelist={[
          'https://dev.pay.walletconnect.com',
          'https://staging.pay.walletconnect.com',
          'https://pay.walletconnect.com',
        ]}
        style={styles.webView}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(navState: WebViewNavigation) => {
          Logger.log(
            `WalletConnectPayModal: WebView navigation to ${navState.url}`,
          );
        }}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onError={(syntheticEvent) => {
          const { description } = syntheticEvent.nativeEvent;
          handleError(description || 'Failed to load the form');
        }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scalesPageToFit
        showsVerticalScrollIndicator={false}
        injectedJavaScript={FIT_CONTENT_JS}
      />
    </View>
  );
};

export default CollectDataWebView;
