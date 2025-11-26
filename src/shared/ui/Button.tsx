import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from './Text';

export interface ButtonProps extends TouchableOpacityProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    loading?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
    className?: string;
}

export function Button({
    variant = 'primary',
    size = 'md',
    label,
    loading = false,
    icon,
    fullWidth = false,
    className = '',
    disabled,
    children,
    style,
    ...props
}: ButtonProps) {
    const { colors } = useTheme();

    // Base container styles
    let containerStyle = 'flex-row items-center justify-center rounded-xl';

    // Size styles
    switch (size) {
        case 'sm':
            containerStyle += ' px-3 py-2';
            break;
        case 'md':
            containerStyle += ' px-4 py-3';
            break;
        case 'lg':
            containerStyle += ' px-6 py-4';
            break;
    }

    // Width
    if (fullWidth) {
        containerStyle += ' w-full';
    }

    // Variant styles (backgrounds and borders)
    // We'll use inline styles for colors mostly to be safe with theme
    const getVariantStyles = () => {
        switch (variant) {
            case 'primary':
                return {
                    backgroundColor: colors.primary,
                    borderColor: 'transparent',
                    borderWidth: 0,
                };
            case 'secondary':
                return {
                    backgroundColor: colors.secondary,
                    borderColor: 'transparent',
                    borderWidth: 0,
                };
            case 'outline':
                return {
                    backgroundColor: 'transparent',
                    borderColor: colors.border,
                    borderWidth: 1,
                };
            case 'ghost':
                return {
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    borderWidth: 0,
                };
            case 'destructive':
                return {
                    backgroundColor: colors.destructive,
                    borderColor: 'transparent',
                    borderWidth: 0,
                };
            default:
                return {};
        }
    };

    // Text color based on variant
    const getTextColor = () => {
        switch (variant) {
            case 'primary':
                return 'primary-foreground';
            case 'secondary':
                return 'secondary-foreground';
            case 'outline':
                return 'default';
            case 'ghost':
                return 'default';
            case 'destructive':
                return 'white'; // Usually white on destructive
            default:
                return 'default';
        }
    };

    const variantStyles = getVariantStyles();
    const textColor = getTextColor();

    return (
        <TouchableOpacity
            className={`${containerStyle} ${className} ${disabled || loading ? 'opacity-50' : ''}`}
            style={[variantStyles, style]}
            disabled={disabled || loading}
            activeOpacity={0.7}
            {...props}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variant === 'outline' || variant === 'ghost' ? colors.foreground : '#FFFFFF'}
                />
            ) : (
                <>
                    {icon && <View className="mr-2">{icon}</View>}
                    {label ? (
                        <Text
                            variant="button"
                            color={textColor as any}
                            style={variant === 'primary' ? { color: colors['primary-foreground'] } : {}}
                        >
                            {label}
                        </Text>
                    ) : children}
                </>
            )}
        </TouchableOpacity>
    );
}
