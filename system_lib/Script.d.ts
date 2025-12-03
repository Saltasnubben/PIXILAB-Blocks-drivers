interface ScriptEnv {
	// Script environment provided by Blocks
}

declare module "system_lib/Script" {
	export class Script {
		constructor(env: ScriptEnv);
	}
	export { ScriptEnv };
}
