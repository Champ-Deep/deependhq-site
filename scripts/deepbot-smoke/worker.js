import './fixture.js';
import { handleToolkit } from '../../worker/toolkit.js';
export default { fetch: (request, env) => handleToolkit(request, env) };
