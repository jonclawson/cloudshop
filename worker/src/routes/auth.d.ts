import { Hono } from 'hono';
import { CloudshopEnv } from '../index';
declare const auth: Hono<CloudshopEnv, import("hono/types").BlankSchema, "/">;
export default auth;
