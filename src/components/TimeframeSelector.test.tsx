import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TimeframeSelector from './TimeframeSelector';

describe('TimeframeSelector', () => {
  it('renders all options and calls onChange when selection changes', () => {
    const handleChange = jest.fn();
    render(<TimeframeSelector onChange={handleChange} />);

    // Check that default option is rendered
    const select = screen.getByLabelText<HTMLSelectElement>(/Timeframe/i);
    expect(select).toBeInTheDocument();
  expect(select.value).toBe('30m');

    // Change selection to '15m'
    fireEvent.change(select, { target: { value: '15m' } });
    expect(handleChange).toHaveBeenCalledWith('15m');
    expect(select.value).toBe('15m');
  });
});
