import type { IdentifierMacro, MacroList } from 'ts-transformer/macros/types';

export const IDENTIFIER_MACROS: MacroList<IdentifierMacro> = {
	Promise: (state, node) => state.TS(node, 'Promise'),
};
