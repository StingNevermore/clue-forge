export type Health = {
	ok: true;
	service: "clue-forge-api";
	time: string;
};

export const getHealth = (): Health => ({
	ok: true,
	service: "clue-forge-api",
	time: new Date().toISOString(),
});
