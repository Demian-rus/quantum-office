exports.openDiagnosticMenu=async function(locator){
 const menu=locator.locator('xpath=ancestor::details[contains(@class,"qd-library-menu")][1]');
 if(await menu.count()&&!await menu.evaluate(el=>el.open))await menu.locator('summary').click();
};
