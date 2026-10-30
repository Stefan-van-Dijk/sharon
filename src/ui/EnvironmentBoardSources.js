import { inAnalysisRange } from './AnalysisRange.js?v=0.4.39';
import { boardPoint } from './BoardOrder.js?v=0.4.39';
import { sortBoards, boardOrderMode } from './BoardOrder.js?v=0.4.39';

// Every source supplies its currently enabled, filtered boards. New sources
// join the same deck by registering this interface, without another navigator.
export function createEnvironmentBoardSources({onOpen = () => {}} = {}) {
  const sources = new Set(), owners = new WeakMap();
  const registry = {
    register(source) { sources.add(source); return () => sources.delete(source); },
    getBoards() {
      return [...sources].flatMap(source => (source.getBoards?.() || []).map(board => {
        owners.set(board, source);
        return board;
      }));
    },
    show(board, center) {
      let items = registry.getBoards().filter(item=>inAnalysisRange(boardPoint(item),center));
      if (!items.includes(board)) items.push(board);
      let mode = null;
      const show = current => {
        if (mode !== boardOrderMode()) { items = sortBoards(items, center); mode = boardOrderMode(); }
        const index = items.indexOf(current);
        const next = items.length > 1 ? items[(index + 1) % items.length] : null;
        const previous = items.length > 1 ? items[(index - 1 + items.length) % items.length] : null;
        const move = step => {
          if (mode !== boardOrderMode()) { items = sortBoards(items, center); mode = boardOrderMode(); }
          show(items[(items.indexOf(current) + step + items.length) % items.length]);
        };
        onOpen(current, {next, previous, onNext:next ? () => move(1) : null, onPrevious:previous ? () => move(-1) : null});
      };
      show(board);
    },
    openBoard(board, navigation) {
      const source = owners.get(board);
      if (!source?.openBoard) return false;
      source.openBoard(board, navigation);
      return true;
    }
  };
  return registry;
}
