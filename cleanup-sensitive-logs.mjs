import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to recursively find all files
function findFiles(dir, extensions, exclude = []) {
  const files = [];
  
  function scan(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip excluded directories
          const shouldSkip = exclude.some(ex => {
            const normalizedPath = fullPath.replace(/\\/g, '/');
            return normalizedPath.includes(ex);
          });
          
          if (!shouldSkip) {
            scan(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentDir}:`, error.message);
    }
  }
  
  scan(dir);
  return files;
}

// Function to clean sensitive console logs from a file
function cleanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let lines = content.split('\n');
    
    // Remove lines with sensitive console logs
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim();
      
      // Skip lines that are just whitespace
      if (!trimmed) return true;
      
      // Remove console logs with sensitive patterns
      const sensitivePatterns = [
        // Logs with tokens, passwords, secrets, keys
        /console\.(log|info|debug).*(?:token|password|secret|key|credential|auth|firebase|stripe|api)/i,
        
        // Logs with emoji indicators (debug logs)
        /console\.(log|info|debug).*[🔄🚀📡✅❌🔍🔑🪟⚠️🏛️🏪💰👤🧪⏭️🏗️📊🎉📋🌱🔥🔧🌍📦🖨️🔒🔊]/,
        
        // Logs that dump objects or detailed responses
        /console\.(log|info|debug).*(?:response|data|user|customer|JSON\.stringify)/i,
        
        // Logs in DEV mode blocks that might contain sensitive info
        /console\.(log|info|debug).*(?:Backend|Firebase|Auth|Sync|Token|Sign|Login)/i,
        
        // Simple console.log statements (but preserve console.error and console.warn)
        /^\s*console\.(?:log|info|debug)\s*\(/,
        
        // Logs with backend URLs or endpoints
        /console\.(log|info|debug).*(?:\/api\/|endpoint|url|backend)/i
      ];
      
      // Check if line matches any sensitive pattern
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(line));
      
      if (isSensitive) {
        modified = true;
        return false; // Remove this line
      }
      
      return true; // Keep this line
    });
    
    if (modified) {
      const cleanedContent = cleanedLines.join('\n');
      fs.writeFileSync(filePath, cleanedContent);
      console.log(`✅ Cleaned: ${path.relative(process.cwd(), filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

// Main execution
const projectRoot = path.join(__dirname);
const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
const targetExtensions = ['.ts', '.tsx', '.js', '.jsx'];

console.log('🧹 Starting sensitive console log cleanup...');
console.log(`📁 Project root: ${projectRoot}`);

// Find all relevant files
const files = findFiles(projectRoot, targetExtensions, excludeDirs);
console.log(`📄 Found ${files.length} files to check`);

let cleanedCount = 0;

// Clean each file
for (const file of files) {
  if (cleanFile(file)) {
    cleanedCount++;
  }
}

console.log(`✅ Cleanup complete! Modified ${cleanedCount} files`);
console.log('🔍 Note: console.error and console.warn statements were preserved for debugging');