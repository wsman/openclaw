/**
 * 部署配置
 */

export const deployConfig = {
  docker: {
    gateway: {
      image: 'negentropy-lab/gateway',
      tag: '1.0.0',
      ports: [3000],
    },
    openclaw: {
      image: 'negentropy-lab/openclaw',
      tag: '1.0.0',
      ports: [4000],
    },
  },
  
  kubernetes: {
    namespace: 'negentropy-lab',
    replicas: 2,
    resources: {
      requests: {
        cpu: '100m',
        memory: '256Mi',
      },
      limits: {
        cpu: '500m',
        memory: '512Mi',
      },
    },
  },
};
