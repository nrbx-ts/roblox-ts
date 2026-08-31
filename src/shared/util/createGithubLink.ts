import { grey } from 'shared/util/colors';

const REPO_URL = 'https://github.com/roblox-ts/roblox-ts';

export function issue(id: number) {
	return `More information: ${grey(`${REPO_URL}/issues/${id}`)}`;
}
