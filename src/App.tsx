/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, X } from 'lucide-react';

type Team = 'blue' | 'red';

interface CardState {
  id: number;
  isSolved: boolean;
  solvedBy: Team | 'none' | null;
  failedBy: Team[];
  answer: string;
  imageUrl: string;
}

interface GameState {
  isStarted: boolean;
  isFinished: boolean;
  activeTeam: Team;
  blueScore: number;
  redScore: number;
  cards: CardState[];
  openCardId: number | null;
}

const puzzleImages = import.meta.glob('../puzzles/*.{png,jpg,jpeg,webp,avif,gif}', {
  eager: true,
  import: 'default'
}) as Record<string, string>;

const puzzleEntries = Object.entries(puzzleImages)
  .map(([filePath, imageUrl]) => {
    const filename = filePath.split('/').pop() ?? '';
    const answer = decodeURIComponent(filename)
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .toLowerCase();
    return { answer, imageUrl };
  })
  .filter(entry => entry.answer.length > 0)
  .sort((a, b) => a.answer.localeCompare(b.answer));

const INITIAL_CARDS: CardState[] = puzzleEntries.map((entry, index) => ({
  id: index + 1,
  isSolved: false,
  solvedBy: null,
  failedBy: [],
  answer: entry.answer,
  imageUrl: entry.imageUrl
}));

const DATASET_KEY = INITIAL_CARDS
  .map(card => `${card.answer}|${card.imageUrl}`)
  .join('||');

const INITIAL_STATE: GameState = {
  isStarted: false,
  isFinished: false,
  activeTeam: 'blue',
  blueScore: 0,
  redScore: 0,
  cards: INITIAL_CARDS,
  openCardId: null,
};

function useGameState() {
  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem('tebak-gambar-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        if (parsed && typeof parsed === 'object' && 'state' in parsed && 'datasetKey' in parsed) {
          const persisted = parsed as { state: GameState; datasetKey: string };
          if (persisted.datasetKey === DATASET_KEY) {
            return persisted.state;
          }
          return INITIAL_STATE;
        }

        const legacyState = parsed as GameState;
        if (legacyState?.cards?.length === INITIAL_CARDS.length) {
          return legacyState;
        }
        return INITIAL_STATE;
      } catch (e) {
        return INITIAL_STATE;
      }
    }
    return INITIAL_STATE;
  });

  useEffect(() => {
    localStorage.setItem('tebak-gambar-state', JSON.stringify({
      datasetKey: DATASET_KEY,
      state,
    }));
  }, [state]);

  const startGame = () => setState(s => ({ ...s, isStarted: true }));
  const resetGame = () => {
    localStorage.removeItem('tebak-gambar-state');
    setState(INITIAL_STATE);
  };
  const openCard = (id: number) => setState(s => ({ ...s, openCardId: id }));
  const closeCard = () => setState(s => ({ ...s, openCardId: null }));
  const finishGame = () => setState(s => ({ ...s, isFinished: true }));
  
  const handleCorrect = (id: number) => {
    setState(s => {
      const team = s.activeTeam;
      return {
        ...s,
        cards: s.cards.map(c => c.id === id ? { ...c, isSolved: true, solvedBy: team } : c),
        blueScore: team === 'blue' ? s.blueScore + 10 : s.blueScore,
        redScore: team === 'red' ? s.redScore + 10 : s.redScore,
        activeTeam: team === 'blue' ? 'red' : 'blue',
        openCardId: null,
      };
    });
  };

  const handleWrong = (id: number) => {
    setState(s => {
      const team = s.activeTeam;
      const card = s.cards.find(c => c.id === id);
      if (!card) return s;

      const newFailedBy = [...(card.failedBy || []), team];

      return {
        ...s,
        cards: s.cards.map(c => c.id === id ? { ...c, failedBy: newFailedBy } : c),
        blueScore: team === 'blue' ? s.blueScore - 5 : s.blueScore,
        redScore: team === 'red' ? s.redScore - 5 : s.redScore,
        activeTeam: team === 'blue' ? 'red' : 'blue',
      };
    });
  };

  const handleRevealClose = (id: number) => {
    setState(s => ({
      ...s,
      cards: s.cards.map(c => c.id === id ? { ...c, isSolved: true, solvedBy: 'none' } : c),
      openCardId: null,
    }));
  };

  return { state, startGame, resetGame, openCard, closeCard, handleCorrect, handleWrong, handleRevealClose, finishGame };
}

const Hero: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4"
    >
      <motion.h1 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-5xl md:text-7xl font-black tracking-tighter mb-8 text-center"
      >
        TEBAK <span className="text-emerald-400">GAMBAR</span>
      </motion.h1>
      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        onClick={onStart}
        className="px-8 py-4 bg-white text-black font-bold text-xl rounded-full hover:scale-105 transition-transform shadow-lg"
      >
        Start Game
      </motion.button>
    </motion.div>
  );
}

const GameBoard: React.FC<{ 
  state: GameState; 
  onOpen: (id: number) => void;
  onReset: () => void;
}> = ({ 
  state, 
  onOpen, 
  onReset
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="min-h-screen bg-zinc-100 text-zinc-900 p-4 md:p-8 flex flex-col max-w-5xl mx-auto"
    >
      <header className="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm">
        <div className={`flex-1 text-center p-4 rounded-xl transition-all duration-300 ${state.activeTeam === 'blue' ? 'bg-blue-500 text-white shadow-md scale-105' : 'bg-zinc-100 text-zinc-500'}`}>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-1">Blue Team</h2>
          <div className="text-4xl font-black">{state.blueScore}</div>
        </div>
        
        <div className="px-4 md:px-8 flex flex-col items-center">
          <Trophy className="w-8 h-8 text-yellow-500 mb-2" />
          <button onClick={onReset} className="text-xs text-zinc-400 hover:text-zinc-600 underline">Reset</button>
        </div>

        <div className={`flex-1 text-center p-4 rounded-xl transition-all duration-300 ${state.activeTeam === 'red' ? 'bg-red-500 text-white shadow-md scale-105' : 'bg-zinc-100 text-zinc-500'}`}>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-1">Red Team</h2>
          <div className="text-4xl font-black">{state.redScore}</div>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-2 md:gap-4 flex-1 content-start">
        {state.cards.map(card => (
          <button
            key={card.id}
            onClick={() => !card.isSolved && onOpen(card.id)}
            disabled={card.isSolved}
            className={`
              aspect-square rounded-xl md:rounded-2xl flex flex-col items-center justify-center p-2 transition-all
              ${card.isSolved 
                ? (card.solvedBy === 'blue' ? 'bg-blue-500 text-white' 
                  : card.solvedBy === 'red' ? 'bg-red-500 text-white' 
                  : 'bg-zinc-800 text-white') 
                : 'bg-white text-zinc-300 hover:bg-zinc-50 hover:text-zinc-400 shadow-sm hover:shadow-md hover:-translate-y-1'}
            `}
          >
            <span className={`font-black ${card.isSolved ? 'text-xl md:text-2xl opacity-50' : 'text-3xl md:text-5xl'}`}>
              {card.id}
            </span>
            {card.isSolved && (
              <span className="text-sm md:text-lg font-bold mt-1 md:mt-2 text-center break-words w-full leading-tight">
                {card.answer.toUpperCase()}
              </span>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

const CardModal: React.FC<{
  card: CardState;
  activeTeam: Team;
  onClose: () => void;
  onCorrect: (id: number) => void;
  onWrong: (id: number) => void;
  onRevealClose: (id: number) => void;
}> = ({
  card,
  activeTeam,
  onClose,
  onCorrect,
  onWrong,
  onRevealClose
}) => {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'wrong' | 'correct'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const bothFailed = (card.failedBy || []).length >= 2;

  useEffect(() => {
    if (!bothFailed) {
      inputRef.current?.focus();
    }
  }, [bothFailed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== 'idle' || bothFailed) return;

    if (input.trim().toLowerCase() === card.answer.toLowerCase()) {
      setStatus('correct');
      setTimeout(() => {
        onCorrect(card.id);
      }, 1000);
    } else {
      setStatus('wrong');
      setTimeout(() => {
        setStatus('idle');
        setInput('');
        onWrong(card.id);
        if (!bothFailed) {
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ 
          scale: status === 'correct' ? 1.05 : 1, 
          opacity: 1, 
          y: 0,
          x: status === 'wrong' ? [-10, 10, -10, 10, 0] : 0
        }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        className={`w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl relative ${
          status === 'correct' ? 'ring-4 ring-emerald-500' : status === 'wrong' ? 'ring-4 ring-red-500' : ''
        }`}
      >
        <button 
          onClick={bothFailed ? () => onRevealClose(card.id) : onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="aspect-video relative bg-zinc-900">
          <img 
            src={card.imageUrl} 
            alt={`Puzzle ${card.id}`}
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
          
          <AnimatePresence>
            {status !== 'idle' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`absolute inset-0 flex items-center justify-center ${
                  status === 'correct' ? 'bg-emerald-500/80' : 'bg-red-500/80'
                }`}
              >
                <span className="text-white text-6xl font-black uppercase tracking-widest drop-shadow-lg">
                  {status === 'correct' ? 'Correct!' : 'Wrong!'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-zinc-800">Card {card.id}</h3>
            {!bothFailed && (
              <div className={`px-4 py-1.5 rounded-full text-sm font-bold text-white transition-colors duration-300 ${
                activeTeam === 'blue' ? 'bg-blue-500' : 'bg-red-500'
              }`}>
                {activeTeam === 'blue' ? 'Blue Team\'s Turn' : 'Red Team\'s Turn'}
              </div>
            )}
            {bothFailed && (
              <div className="px-4 py-1.5 rounded-full text-sm font-bold text-white bg-zinc-800">
                Revealed
              </div>
            )}
          </div>

          {!bothFailed ? (
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={status !== 'idle'}
                placeholder="Type your guess here..."
                className="flex-1 px-6 py-4 bg-zinc-100 border-2 border-transparent focus:border-zinc-300 rounded-2xl outline-none text-lg font-medium transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status !== 'idle' || !input.trim()}
                className={`px-8 py-4 rounded-2xl font-bold text-white text-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 ${
                  activeTeam === 'blue' ? 'bg-blue-500' : 'bg-red-500'
                }`}
              >
                Submit
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="text-2xl font-bold text-zinc-800">
                The answer was: <span className="text-emerald-600 uppercase">{card.answer}</span>
              </div>
              <button
                onClick={() => onRevealClose(card.id)}
                className="px-8 py-4 rounded-2xl font-bold text-white text-lg bg-zinc-800 hover:bg-zinc-900 transition-all duration-300 hover:scale-105"
              >
                Close & Continue
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

const WinnerPage: React.FC<{ state: GameState; onReset: () => void }> = ({ state, onReset }) => {
  const isTie = state.blueScore === state.redScore;
  const winner = state.blueScore > state.redScore ? 'Blue Team' : 'Red Team';
  const winnerColor = isTie ? 'text-zinc-400' : state.blueScore > state.redScore ? 'text-blue-500' : 'text-red-500';
  const bgColor = isTie ? 'bg-zinc-950' : state.blueScore > state.redScore ? 'bg-blue-950' : 'bg-red-950';

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className={`min-h-screen flex flex-col items-center justify-center text-white p-4 ${bgColor}`}
    >
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring' }}
        className="text-center"
      >
        <Trophy className={`w-32 h-32 mx-auto mb-8 ${winnerColor} drop-shadow-2xl`} />
        <h1 className="text-6xl md:text-8xl font-black mb-4 uppercase tracking-tighter">
          {isTie ? "It's a Tie!" : `${winner} Wins!`}
        </h1>
        <div className="flex items-center justify-center gap-8 text-3xl font-bold mb-12 opacity-80">
          <span className="text-blue-400">Blue: {state.blueScore}</span>
          <span className="text-zinc-500">-</span>
          <span className="text-red-400">Red: {state.redScore}</span>
        </div>
        <button
          onClick={onReset}
          className="px-10 py-5 bg-white text-black font-black text-2xl rounded-full hover:scale-105 transition-transform shadow-2xl"
        >
          Play Again
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const { state, startGame, resetGame, openCard, closeCard, handleCorrect, handleWrong, handleRevealClose, finishGame } = useGameState();

  const allSolved = state.cards.every(c => c.isSolved);

  useEffect(() => {
    if (allSolved && state.isStarted && !state.isFinished) {
      const timer = setTimeout(() => {
        finishGame();
      }, 3000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSolved, state.isStarted, state.isFinished]);

  const activeCard = state.openCardId ? state.cards.find(c => c.id === state.openCardId) : null;

  return (
    <div className="font-sans antialiased">
      <AnimatePresence mode="wait">
        {!state.isStarted ? (
          <Hero key="hero" onStart={startGame} />
        ) : state.isFinished ? (
          <WinnerPage key="winner" state={state} onReset={resetGame} />
        ) : (
          <GameBoard 
            key="game" 
            state={state} 
            onOpen={openCard} 
            onReset={resetGame} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeCard && !state.isFinished && (
          <CardModal
            key="modal"
            card={activeCard}
            activeTeam={state.activeTeam}
            onClose={closeCard}
            onCorrect={handleCorrect}
            onWrong={handleWrong}
            onRevealClose={handleRevealClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
