import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    ReactNode,
    useCallback,
} from 'react';

// Define the possible card sizes
export const CARD_SIZES = ['standard', 'compact', 'poster'] as const;

export type CardSize = (typeof CARD_SIZES)[number];

/**
 * The single list both the rehydrate and the setter validate against.
 *
 * These two checks used to be written out separately and had drifted: the
 * setter accepted 'poster' but the localStorage read did not, so choosing the
 * poster view and reloading silently dropped back to compact.
 */
const isCardSize = (value: unknown): value is CardSize =>
    typeof value === 'string' && (CARD_SIZES as readonly string[]).includes(value);

// Define the shape of the context data
interface ViewSettingsContextProps {
    cardSize: CardSize;
    setCardSize: (size: CardSize) => void;
}

// Create the context with a default value (can be undefined initially)
const ViewSettingsContext = createContext<ViewSettingsContextProps | undefined>(undefined);

// Define the props for the provider component
interface ViewSettingsProviderProps {
    children: ReactNode;
}

// Local storage key
const LOCAL_STORAGE_KEY = 'appViewSettings';

// Create the Provider component
export const ViewSettingsProvider: React.FC<ViewSettingsProviderProps> = ({ children }) => {
    const [cardSize, setCardSizeState] = useState<CardSize>(() => {
        // Load initial state from localStorage or default to 'standard'
        try {
            const storedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedSettings) {
                const settings = JSON.parse(storedSettings);
                // Validate the stored value
                if (isCardSize(settings?.cardSize)) {
                    return settings.cardSize;
                }
            }
        } catch (error) {
            console.error('Error reading view settings from localStorage', error);
        }
        return 'compact'; // Default value
    });

    // Effect to save changes to localStorage whenever cardSize changes
    useEffect(() => {
        try {
            const settings = { cardSize };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error('Error saving view settings to localStorage', error);
        }
    }, [cardSize]);

    // Memoized function to update state, preventing unnecessary re-renders
    const setCardSize = useCallback((size: CardSize) => {
        // Basic validation
        if (isCardSize(size)) {
            setCardSizeState(size);
        } else {
            console.warn(`Invalid card size attempted: ${size}`);
        }
    }, []);

    // Value provided by the context
    const value = { cardSize, setCardSize };

    return <ViewSettingsContext.Provider value={value}>{children}</ViewSettingsContext.Provider>;
};

export const useViewSettings = (): ViewSettingsContextProps => {
    const context = useContext(ViewSettingsContext);
    if (context === undefined) {
        throw new Error('useViewSettings must be used within a ViewSettingsProvider');
    }
    return context;
};
