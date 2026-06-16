// Brings @testing-library/jest-dom's matcher augmentation (toBeInTheDocument,
// toHaveAttribute, ...) into the TypeScript program. The runtime import lives in
// jest.setup.ts, which is outside `src` and so isn't seen by `tsc -b`.
import '@testing-library/jest-dom';
