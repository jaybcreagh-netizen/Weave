import React, { Component, ReactNode } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { AlertTriangle, RefreshCw, Copy } from 'lucide-react-native';
import { logError } from '../lib/error-logger';
import { captureException } from '../lib/sentry';
import * as Clipboard from 'expo-clipboard';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * Error Boundary Component
 *
 * Catches React errors and displays a fallback UI
 * Logs errors to Sentry and local storage
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: error.stack || null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Log to Sentry
    captureException(error, {
      componentStack: errorInfo.componentStack,
      type: 'react_error_boundary',
    });

    // Log locally
    logError(error, {
      componentStack: errorInfo.componentStack,
      type: 'react_error_boundary',
    }, 'error');
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const errorText = `Error: ${error?.message || 'Unknown error'}\n\nStack:\n${errorInfo || 'No stack trace'}`;

    try {
      await Clipboard.setStringAsync(errorText);
      alert('Error details copied to clipboard');
    } catch (e) {
      console.error('Failed to copy error to clipboard:', e);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-neutral-900 px-6 pt-20">
          <View className="items-center mb-8">
            <View className="bg-red-500/10 p-4 rounded-full mb-4">
              <AlertTriangle size={48} color="#ef4444" />
            </View>

            <Text className="text-2xl font-bold text-white mb-2 text-center">
              Something went wrong
            </Text>

            <Text className="text-neutral-400 text-center mb-6">
              The app encountered an unexpected error. This has been logged and will help us improve.
            </Text>
          </View>

          {__DEV__ && this.state.error && (
            <ScrollView className="bg-neutral-800 rounded-lg p-4 mb-6 max-h-64">
              <Text className="text-xs font-mono text-red-400 mb-2">
                {this.state.error.message}
              </Text>
              {this.state.errorInfo && (
                <Text className="text-xs font-mono text-neutral-500">
                  {this.state.errorInfo}
                </Text>
              )}
            </ScrollView>
          )}

          <View className="gap-3">
            <TouchableOpacity
              onPress={this.handleReset}
              className="bg-indigo-600 py-4 px-6 rounded-xl flex-row items-center justify-center"
            >
              <RefreshCw size={20} color="white" />
              <Text className="text-white font-semibold ml-2">
                Try Again
              </Text>
            </TouchableOpacity>

            {__DEV__ && (
              <TouchableOpacity
                onPress={this.handleCopyError}
                className="bg-neutral-800 py-4 px-6 rounded-xl flex-row items-center justify-center"
              >
                <Copy size={20} color="#a3a3a3" />
                <Text className="text-neutral-400 font-semibold ml-2">
                  Copy Error Details
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text className="text-neutral-600 text-xs text-center mt-8">
            If this problem persists, try restarting the app or clearing your data from Settings.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}
