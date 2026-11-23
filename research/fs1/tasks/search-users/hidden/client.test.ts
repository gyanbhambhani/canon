import type { ClientTest } from "../../../harness/client-api";

type Profile = { email: string; name: string };

export const tests: ClientTest[] = [
  {
    id: "searchUsers-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { searchUsers } = await t.feature("searchUsers");
      const marker = t.unique("Qx");
      const second = `${t.unique("b")}@example.com`;
      const first = `${t.unique("a")}@example.com`;
      t.ok(await signup(t.baseUrl, second, `Grace ${marker} Hopper`, "correct horse"));
      t.ok(await signup(t.baseUrl, first, `${marker}son`, "correct horse"));
      const found = t.ok<Profile[]>(await searchUsers(t.baseUrl, ` ${marker} `));
      t.equal(found, [
        { email: first, name: `${marker}son` },
        { email: second, name: `Grace ${marker} Hopper` },
      ]);
      const server = await t.http("GET", `/users/search?q=${encodeURIComponent(marker)}`);
      t.equal(found, server.body, "the client parsed what the server returned");
    },
  },
  {
    id: "searchUsers-rules",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { searchUsers } = await t.feature("searchUsers");
      const marker = t.unique("Zq");
      t.ok(await signup(t.baseUrl, `${t.unique("u")}@example.com`, marker, "correct horse"));
      t.equal(t.ok(await searchUsers(t.baseUrl, marker.toLowerCase())), [], "case-sensitive");
      t.fails(await searchUsers(t.baseUrl, " Z "), "ValidationError");
      t.fails(await searchUsers(t.baseUrl, ""), "ValidationError");
    },
  },
];
