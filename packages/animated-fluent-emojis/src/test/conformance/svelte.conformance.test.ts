import { defineConformanceSuite } from "./suite.js";
import { createSvelteDriver } from "./svelte-driver.svelte.js";

defineConformanceSuite("svelte", createSvelteDriver);
