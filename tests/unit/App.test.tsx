import { createElement } from 'react';
import { render } from '@testing-library/react-native';
import App from '../../App';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('<App />', () => {
  it('renders the institutional auth screen', async () => {
    const tree = await render(createElement(App));
    expect(tree.getByText('MyCCS Institutional Auth')).toBeTruthy();
  });
});
