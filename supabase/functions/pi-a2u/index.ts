// @ts-ignore-file - Deno edge function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handlePiA2uRequest } from "./handler.ts";

serve((req) => handlePiA2uRequest(req));
