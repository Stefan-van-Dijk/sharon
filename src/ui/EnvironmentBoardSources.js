import { boardDiscoveryEnabled } from './BoardViewport.js?v=0.4.56';
import { inAnalysisRange } from './AnalysisRange.js?v=0.4.56';
import { boardPoint } from './BoardOrder.js?v=0.4.56';
import { sortBoards, boardOrderMode } from './BoardOrder.js?v=0.4.56';

// Every source supplies its currently enabled, filtered boards. New sources
// join the same deck by registering this interface, without another navigator.
export function createEnvironmentBoardSources({onOpen = () => {},onEmpty=()=>{}} = {}) {
  const sources = new Set(), owners = new WeakMap(),sourceIds=new WeakMap();let sourceId=0;
  const key=board=>String(sourceIds.get(owners.get(board)))+':'+String(board.id??board.properties?.wikidata??board.properties?.id??board.sourceRef??JSON.stringify(boardPoint(board)));
  const registry = {
    register(source) { sourceIds.set(source,++sourceId);sources.add(source); return () => sources.delete(source); },
    getBoards() {
      return [...sources].flatMap(source => (source.getBoards?.() || []).filter(board=>source.acceptsBoard?.(board)??true).map(board => {
        owners.set(board, source);
        return board;
      }));
    },
    show(board, center) {
      let items = registry.getBoards().filter(item=>inAnalysisRange(boardPoint(item),center));
      if (!items.includes(board)) items.push(board);
      const explore=boardDiscoveryEnabled();
      let mode = null;
      const refresh=()=>{
        const latest=registry.getBoards(),byKey=new Map(latest.map(item=>[key(item),item]));
        items=items.filter(item=>{const source=owners.get(item);return sources.has(source)&&(source.acceptsBoard?.(item)??true);}).map(item=>byKey.get(key(item))||item);
        if(explore){const seen=new Set(items.map(key));for(const item of latest)if(!seen.has(key(item))){seen.add(key(item));items.push(item);}}
        mode=null;
      };
      const show = current => {
        if (mode !== boardOrderMode()) { items = sortBoards(items, center); mode = boardOrderMode(); }
        const index = items.indexOf(current);
        const next = items.length > 1 ? items[(index + 1) % items.length] : null;
        const previous = items.length > 1 ? items[(index - 1 + items.length) % items.length] : null;
        const move = step => {
          const currentKey=key(current),oldIndex=items.indexOf(current);
          refresh();if(!items.length){onEmpty();return;}
          current=items.find(item=>key(item)===currentKey)||items[(oldIndex+(step>0?-1:0)+items.length)%items.length];
          if (mode !== boardOrderMode()) { items = sortBoards(items, center); mode = boardOrderMode(); }
          show(items[(items.indexOf(current) + step + items.length) % items.length]);
        };
        onOpen(current, {next, previous, onNext:(next||explore) ? () => move(1) : null, onPrevious:(previous||explore) ? () => move(-1) : null});
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
