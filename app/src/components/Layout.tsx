import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { useTradingStoreSync } from '../hooks/useTradingStoreSync';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.3,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  useTradingStoreSync();

  return (
    <div className="min-h-[100dvh] flex flex-col relative z-[1]">
      <Navbar />
      <main className="flex-1 pt-[56px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={pageTransition}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
