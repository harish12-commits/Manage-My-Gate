const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.expo') && !file.includes('dist')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const baseDir = path.join(__dirname, '..');
const files = walk(baseDir);
console.log('Total code files:', files.length);

const stats = {
  kav: [],
  bottomSheet: [],
  modal: [],
  textInput: [],
  absoluteBottom: [],
  fixedDimensions: [],
  screenShell: [],
  keyboardAvoidingShell: [],
  forms: []
};

files.forEach(f => {
  const rel = path.relative(baseDir, f);
  const content = fs.readFileSync(f, 'utf8');

  if (content.includes('KeyboardAvoidingView')) stats.kav.push(rel);
  if (content.includes('BottomSheet') || content.includes('BottomSheetModal') || content.includes('@gorhom/bottom-sheet')) stats.bottomSheet.push(rel);
  if (content.includes('Modal') && !content.includes('BottomSheetModal')) stats.modal.push(rel);
  if (content.includes('TextInput')) stats.textInput.push(rel);
  if (content.includes('ScreenShell')) stats.screenShell.push(rel);
  if (content.includes('KeyboardAvoidingShell')) stats.keyboardAvoidingShell.push(rel);
  
  if (content.match(/position:\s*['"]absolute['"]/i) && content.match(/bottom:\s*/i)) {
    stats.absoluteBottom.push(rel);
  }
  if (content.match(/Dimensions\.get/i) || content.match(/useWindowDimensions/i)) {
    stats.fixedDimensions.push(rel);
  }
  if ((content.includes('TextInput') || content.includes('useForm') || content.includes('Controller')) && (f.includes('Screen') || f.includes('app') || f.includes('Modal') || f.includes('Sheet') || f.includes('Step') || f.includes('Form'))) {
    stats.forms.push(rel);
  }
});

console.log('=== SUMMARY ===');
console.log('KeyboardAvoidingView count:', stats.kav.length);
console.log('BottomSheet count:', stats.bottomSheet.length);
console.log('Modal count:', stats.modal.length);
console.log('TextInput count:', stats.textInput.length);
console.log('ScreenShell count:', stats.screenShell.length);
console.log('KeyboardAvoidingShell count:', stats.keyboardAvoidingShell.length);
console.log('Absolute bottom count:', stats.absoluteBottom.length);
console.log('Fixed Dimensions count:', stats.fixedDimensions.length);
console.log('Form screens/modals count:', stats.forms.length);

console.log('\n--- KeyboardAvoidingView files ---');
console.log(stats.kav.join('\n'));

console.log('\n--- BottomSheet files ---');
console.log(stats.bottomSheet.join('\n'));

console.log('\n--- Modal files ---');
console.log(stats.modal.join('\n'));

console.log('\n--- Absolute Bottom files ---');
console.log(stats.absoluteBottom.join('\n'));

console.log('\n--- Fixed Dimensions files ---');
console.log(stats.fixedDimensions.join('\n'));

console.log('\n--- Form screens/modals ---');
console.log(stats.forms.join('\n'));
