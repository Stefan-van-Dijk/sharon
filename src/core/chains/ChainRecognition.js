import { CHAIN_CATALOG } from './ChainCatalog.js?v=0.4.20';

const normalize = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu,'')
  .toLocaleLowerCase('nl').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const aliases = chain => [chain.name,...(chain.id==='Q1653985'?['AH','AH XL','AH to go']:[]),
  ...(chain.id==='Q2489350'?['Deka Markt']:[])].map(normalize);

// Stay local and deterministic. Whole words prevent AH matching inside another
// name. A short search prefix is accepted only when it identifies one chain.
export function recognizeChain(value) {
  const query=normalize(value);
  if(!query)return null;
  const exact=CHAIN_CATALOG.filter(chain=>aliases(chain).some(alias=>(' '+query+' ').includes(' '+alias+' ')));
  if(exact.length)return exact.length===1?exact[0]:null;
  if(query.length<3)return null;
  const partial=CHAIN_CATALOG.filter(chain=>aliases(chain).some(alias=>alias.startsWith(query)));
  return partial.length===1?partial[0]:null;
}
