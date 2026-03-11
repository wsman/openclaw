import { ClusterBackplane } from './backplane/ClusterBackplane';
import { ClusterTopologyStore } from './ClusterTopologyStore';

type RuntimeContext = {
  backplane: ClusterBackplane;
  topologyStore: ClusterTopologyStore;
};

let runtimeContext: RuntimeContext | null = null;

export function setClusterRuntime(context: RuntimeContext | null): void {
  runtimeContext = context;
}

export function getClusterRuntime(): RuntimeContext | null {
  return runtimeContext;
}

