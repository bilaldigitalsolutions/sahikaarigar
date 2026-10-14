import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  usePathname() {
    return '/';
  },
}));

// Mock Next.js image (plain JS so SWC can parse this .js file without JSX/TS syntax)
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    const React = require('react');
    return React.createElement('img', props);
  },
}));