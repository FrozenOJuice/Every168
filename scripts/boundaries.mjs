import ts from "typescript";
import { posix as path } from "node:path";

export function checkImports(file, source) {
  const problems = [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const targets = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      targets.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require")) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      targets.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const ownModule = file.match(/^apps\/api\/src\/modules\/([^/]+)\//)?.[1];
  for (const target of targets) {
    const destination = target.startsWith(".")
      ? path.normalize(path.join(path.dirname(file), target))
      : target;
    const persistence =
      /^(pg|drizzle-orm)(\/|$)/.test(target) ||
      /apps\/api\/src\/infrastructure\/database\//.test(destination) ||
      /\.table(?:\.|$)/.test(destination);
    const allowedPersistence =
      /\.repository\.ts$|\.table\.ts$/.test(file) ||
      file.startsWith("apps/api/src/infrastructure/") ||
      file === "apps/api/src/composition.ts" ||
      file === "apps/api/src/shared/auth/auth.ts";
    if (file.startsWith("apps/api/src/") && persistence && !allowedPersistence)
      problems.push(
        `${file}: persistence import outside repository/infrastructure (${target})`,
      );
    if (
      file.startsWith("apps/web/") &&
      (persistence || /apps\/api|@168hours\/api(?:\/|$)/.test(destination))
    )
      problems.push(`${file}: web imports API/persistence (${target})`);
    if (
      file.startsWith("packages/") &&
      (persistence ||
        destination.startsWith("apps/") ||
        /^@168hours\/(api|web)(\/|$)/.test(target))
    )
      problems.push(
        `${file}: shared package imports app/persistence (${target})`,
      );
    if (/\.routes\.ts$/.test(file) && /\.repository(?:\.|$)/.test(destination))
      problems.push(`${file}: route bypasses service (${target})`);
    if (
      /\.repository\.ts$/.test(file) &&
      /\.(routes|service)(?:\.|$)/.test(destination)
    )
      problems.push(`${file}: repository imports an upper layer (${target})`);
    if (ownModule) {
      const otherModule = destination.match(
        /^apps\/api\/src\/modules\/([^/]+)\//,
      )?.[1];
      const foreignTable =
        file.endsWith(".table.ts") && /\.table(?:\.|$)/.test(destination);
      if (
        otherModule &&
        ownModule !== otherModule &&
        !/\.service(?:\.|$)/.test(destination) &&
        !foreignTable
      )
        problems.push(
          `${file}: imports private ${otherModule} implementation (${target})`,
        );
      if (/apps\/api\/src\/(composition|app|server)(?:\.|$)/.test(destination))
        problems.push(
          `${file}: module imports application composition (${target})`,
        );
    }
  }
  return problems;
}
