import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders Home Server Dashboard header', async () => {
  render(<App />);
  const header = await screen.findByText(/Home Server Dashboard/i);
  expect(header).toBeInTheDocument();
});
