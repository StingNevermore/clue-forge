import { createRouter, createWebHistory } from "vue-router";
import NovelEditor from "./NovelEditor.vue";
import NovelList from "./NovelList.vue";

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{ path: "/", redirect: "/novels" },
		{ path: "/novels", component: NovelList },
		{ path: "/novels/new", component: NovelEditor },
		{ path: "/novels/:id", component: NovelEditor, props: true },
	],
});
