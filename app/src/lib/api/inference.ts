/**
	* Health namespace: lightweight `/health` liveness probe only.
	*
	* The previous `/ready` deep-dependency widget was removed (its
	* `ProviderHealthCard/Summary` consumers are gone). The navbar / login
	* status chip and any future "API online?" indicator only need a
	* boolean — they don't surface the dependency map.
	*/

import { request } from "./client.js";

export const health = {
	ping(): Promise<boolean> {
		return request<{ status: string }>("/health")
			.then(() => true)
			.catch(() => false);
	},
};
