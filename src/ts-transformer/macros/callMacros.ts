import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import type { CallMacro, MacroList } from 'ts-transformer/macros/types';
import { convertToIndexableExpression } from 'ts-transformer/util/convertToIndexableExpression';
import { getImportParts } from 'ts-transformer/util/createImportExpression';
import { createTruthinessChecks } from 'ts-transformer/util/createTruthinessChecks';

const PRIMITIVE_LUAU_TYPES = new Set([
	'nil',
	'boolean',
	'string',
	'number',
	'table',
	'userdata',
	'function',
	'thread',
	'vector',
	'buffer',
]);

export const CALL_MACROS: MacroList<CallMacro> = {
	assert: (state, node, _expression, args) => {
		args[0] = createTruthinessChecks(state, args[0], node.arguments[0]);
		return luau.call(luau.globals.assert, args);
	},

	typeOf: (_state, _node, _expression, args) => luau.call(luau.globals.typeof, args),

	typeIs: (_state, _node, _expression, args) => {
		const [value, typeStr] = args;
		const typeFunc =
			luau.isStringLiteral(typeStr) && PRIMITIVE_LUAU_TYPES.has(typeStr.value)
				? luau.globals.type
				: luau.globals.typeof;
		return luau.binary(luau.call(typeFunc, [value]), '==', typeStr);
	},

	classIs: (_state, _node, _expression, args) => {
		const [value, typeStr] = args;
		return luau.binary(luau.property(convertToIndexableExpression(value), 'ClassName'), '==', typeStr);
	},

	identity: (_state, _node, _expression, args) => args[0],

	$range: (_state, node) => {
		DiagnosticService.addDiagnostic(errors.noRangeMacroOutsideForOf(node.expression));
		return luau.none();
	},

	$tuple: (_state, node) => {
		DiagnosticService.addDiagnostic(errors.noTupleMacroOutsideReturn(node));
		return luau.none();
	},

	$getModuleTree: (state, node) => {
		const parts = getImportParts(state, node.getSourceFile(), node.arguments[0]);
		// converts the flat array into { root, { "rest", "of", "path" } }
		return luau.array([parts.shift()!, luau.array(parts)]);
	},
};
