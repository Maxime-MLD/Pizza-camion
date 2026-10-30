import {deploymentConfig as preview} from '../src/config/deployment.preview';
import {deploymentConfig as production} from '../src/config/deployment.production';
const bindings=(config:typeof preview|typeof production)=>({FORNO_DEPLOYMENT_PROFILE:config.profile,FORNO_EXPECTED_SUPABASE_REF:config.supabaseRef,FORNO_APP_ORIGIN:config.origin,FORNO_PREVIEW_BRANCH:config.previewBranch});
export const previewBindings=bindings(preview);
export const productionBindings=bindings(production);
