import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useTheme } from '../context/ThemeContext';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    messageId: string;
    sourceChainName: string;
    destNetworkName: string;
    state: number;
    tokenAmounts: Array<{
      amount: string;
      token: {
        symbol: string;
        decimals: number;
      }
    }>;
    blockTimestamp: string;
    sender: string;
    receiver: string;
    sourceTxHash?: string;
    destinationTxHash?: string;
    bridgingMessageId?: string;
  } | null;
}

const TransactionModal = ({ isOpen, onClose, transaction }: TransactionModalProps) => {
  const { theme } = useTheme();

  if (!transaction) return null;

  const formatAmount = (amount: string, decimals: number) => {
    return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full max-w-md transform overflow-hidden rounded-2xl p-6 text-left align-middle shadow-xl transition-all ${
                theme === 'night' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
              }`}>
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 mb-4"
                >
                  Transaction Details
                </Dialog.Title>

                <div className="mt-2 space-y-4">
                  <div>
                    <p className="text-sm font-medium">Message ID</p>
                    <p className="text-sm">{transaction.messageId}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <p className="text-sm">
                      {transaction.state === 2 && 'Completed'}
                      {transaction.state === 1 && 'In Progress'}
                      {transaction.state === 3 && 'Failed'}
                      {transaction.state === 0 && 'Failed'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Amount</p>
                    {transaction.tokenAmounts?.map((token, index) => (
                      <p key={index} className="text-sm">
                        {formatAmount(token.amount, token.token.decimals)} {token.token.symbol}
                      </p>
                    ))}
                  </div>

                  <div>
                    <p className="text-sm font-medium">Timestamp</p>
                    <p className="text-sm">{new Date(transaction.blockTimestamp).toLocaleString()}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Sender</p>
                    <p className="text-sm">{transaction.sender}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Receiver</p>
                    <p className="text-sm">{transaction.receiver}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Source Chain</p>
                    <p className="text-sm">{transaction.sourceChainName}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Destination Chain</p>
                    <p className="text-sm">{transaction.destNetworkName}</p>
                  </div>

                  {transaction.sourceTxHash && (
                    <div>
                      <p className="text-sm font-medium">Source Transaction</p>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${transaction.sourceTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-500 hover:text-blue-600"
                      >
                        {transaction.sourceTxHash}
                      </a>
                    </div>
                  )}

                  {transaction.sourceChainName === 'CCIP' && (
                    <div>
                      <p className="text-sm font-medium">Bridging Information</p>
                      {transaction.bridgingMessageId ? (
                        <a
                          href={`https://ccip.chain.link/msg/${transaction.bridgingMessageId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:text-blue-600"
                        >
                          {transaction.bridgingMessageId}
                        </a>
                      ) : transaction.destinationTxHash ? (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${transaction.destinationTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:text-blue-600"
                        >
                          {transaction.destinationTxHash}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-500">No bridging information available</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium ${
                      theme === 'night'
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'bg-amber-500 text-white hover:bg-amber-600'
                    }`}
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default TransactionModal; 