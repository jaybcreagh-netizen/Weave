import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from './Text';
import { Icon } from './Icon';

export interface ButtonProps extends TouchableOpacityProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    loading?: boolean;
    icon?: React.ReactNode | string;
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
    onPress,
    delayLongPress, // Extract this prop if it exists on TouchableOpacityProps but we don't need to do anything special with it, just pass it down via ...props
    ...props
}: ButtonProps) {
    const { colors } = useTheme();

    // Anti-double-tap ref
    const lastPressTime = React.useRef(0);
    const DEBOUNCE_TIME = 500; // ms

    const handlePress = React.useCallback((e: any) => {
        const now = Date.now();
        if (now - lastPressTime.current < DEBOUNCE_TIME) {
            return;
        }
        lastPressTime.current = now;
        onPress?.(e);
    }, [onPress]);

    // Map variant to container classes
    const variantClasses = {
        primary: 'bg-primary border border-transparent',
        secondary: 'bg-secondary border border-transparent',
        outline: 'bg-transparent border border-border',
        ghost: 'bg-transparent border border-transparent',
        destructive: 'bg-destructive border border-transparent',
    };

    // Map size to container padding
    const sizeClasses = {
        sm: 'px-3 py-2',
        md: 'px-4 py-3',
        lg: 'px-6 py-4',
    };

    // Construct container class
    const containerClass = [
        'flex-row items-center justify-center rounded-xl',
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        variantClasses[variant],
        (disabled || loading) ? 'opacity-50' : '',
        className
    ].filter(Boolean).join(' ');

    // Determine text color based on variant
    // We pass this as className to the Text component to override default color
    const getTextColorStyle = () => {
        switch (variant) {
            case 'primary': return { color: colors['primary-foreground'] };
            case 'secondary': return { color: colors['secondary-foreground'] };
            case 'destructive': return { color: colors['destructive-foreground'] };
            case 'outline':
            case 'ghost':
            default: return { color: colors.foreground };
        }
    };

    const textStyle = getTextColorStyle();

    return (
        <TouchableOpacity
            className={containerClass}
            style={style}
            disabled={disabled || loading}
            activeOpacity={0.7}
            onPress={handlePress}
            {...props}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={['outline', 'ghost'].includes(variant) ? colors.foreground : '#FFFFFF'}
                />
            ) : (
                <>
                    {icon && (
                        <View className="mr-2">
                            {typeof icon === 'string' ? (
                                <Icon name={icon as any} size={16} color={textStyle.color} />
                            ) : (
                                icon
                            )}
                        </View>
                    )}
                    {label ? (
                        <Text
                            variant="button"
                            style={textStyle}
                        >
                            {label}
                        </Text>
                    ) : children}
                </>
            )}
        </TouchableOpacity>
    );
}
