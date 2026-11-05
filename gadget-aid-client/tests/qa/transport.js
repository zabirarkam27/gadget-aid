import { createAuthFetch } from "../../src/utils/authenticatedRequest";
import { getFixtureUser, fixtureFetch } from "./state";
export const authFetch = createAuthFetch({getUser:getFixtureUser,fetchImpl:fixtureFetch});
