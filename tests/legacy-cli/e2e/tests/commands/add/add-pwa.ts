import { join } from 'path';
import { expectFileToExist, readFile, rimraf } from '../../../utils/fs';
import { ng } from '../../../utils/process';

export default async function () {
  // forcibly remove in case another test doesn't clean itself up
  await rimraf('node_modules/@angular/pwa');
  await ng('add', '@angular/pwa', '--skip-confirmation');
  await expectFileToExist(join(process.cwd(), 'src/manifest.webmanifest'));

  // Angular PWA doesn't install as a dependency
  const { dependencies, devDependencies } = JSON.parse(
    await readFile(join(process.cwd(), 'package.json')),
  );
  const hasPWADep = Object.keys({ ...dependencies, ...devDependencies }).some(
    (d) => d === '@angular/pwa',
  );
  if (hasPWADep) {
    throw new Error(`Expected 'package.json' not to contain a dependency on '@angular/pwa'.`);
  }

  // It should generate a SW configuration file (`ngsw.json`).
  const workspaceJson = JSON.parse(await readFile('angular.json'));
  const outputPath = workspaceJson.projects['test-project'].architect.build.options.outputPath;
  const ngswPath = join(process.cwd(), outputPath, 'ngsw.json');

  await ng('build');
  await expectFileToExist(ngswPath);

  // It should correctly generate assetGroups and include at least one URL in each group.
  const ngswJson = JSON.parse(await readFile(ngswPath));
  const assetGroups = ngswJson.assetGroups.map(({ name, urls }) => ({
    name,
    urlCount: urls.length,
  }));
  const emptyAssetGroups = assetGroups.filter(({ urlCount }) => urlCount === 0);

  if (assetGroups.length === 0) {
    throw new Error("Expected 'ngsw.json' to contain at least one asset-group.");
  }
  if (emptyAssetGroups.length > 0) {
    throw new Error(
      'Expected all asset-groups to contain at least one URL, but the following groups are empty: ' +
        emptyAssetGroups.map(({ name }) => name).join(', '),
    );
  }
}
