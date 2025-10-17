#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to recursively find all files with specific extensions
function findFiles(dir, extensions, exclude = []) {
  const files = [];
  
  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip excluded directories
        if (!exclude.some(ex => fullPath.includes(ex))) {
          scan(fullPath);
        }
      } else if (stat.isFile()) {
        // Check if file has one of the target extensions
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scan(dir);
  return files;
}

// Function to clean console logs from a file
function cleanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Patterns to remove - focusing on potentially sensitive logs
  const patterns = [
    // Console logs that expose tokens, credentials, sensitive data
    /^\s*console\.(log|info|debug)\([^)]*(?:token|password|secret|key|credential|auth|user|email|phone|api)[^)]*\);?\s*$/gim,
    
    // Console logs with emoji indicators (often debug logs)
    /^\s*console\.(log|info|debug)\([^)]*[🔄🚀📡✅❌🔍🔑🪟⚠️🏛️🏪💰👤🧪⏭️🏗️👤🏪📊🎉📋🌱🔥🔧🌍📦🖨️🔒🔊][^)]*\);?\s*$/gim,
    
    // Console logs with detailed object dumps
    /^\s*console\.(log|info|debug)\([^)]*JSON\.stringify[^)]*\);?\s*$/gim,
    
    // Console logs in if(DEV) blocks
    /^\s*if\s*\(\s*import\.meta\.env\.DEV\s*\)\s*\{\s*console\.(log|info|debug)\([^}]*\}\s*$/gim,
    
    // Simple console.log statements (but keep error and warn)
    /^\s*console\.(log|info|debug)\([^)]*\);?\s*$/gim,
  ];
  
  let cleanedContent = content;
  
  // Apply each pattern
  for (const pattern of patterns) {
    const newContent = cleanedContent.replace(pattern, '');
    if (newContent !== cleanedContent) {
      modified = true;
      cleanedContent = newContent;
    }
  }
  
  // Remove empty lines that were left after removing console logs
  cleanedContent = cleanedContent.replace(/^\s*\n/gm, '\n');
  
  if (modified) {
    fs.writeFileSync(filePath, cleanedContent);
    return true;
  }
  
  return false;
}

// Main execution
const projectRoot = process.cwd();
const excludeDirs = ['node_modules', '.git', 'dist', 'build'];
const targetExtensions = ['.ts', '.tsx', '.js', '.jsx'];


// Find all relevant files
const files = findFiles(projectRoot, targetExtensions, excludeDirs);

let cleanedCount = 0;

// Clean each file
for (const file of files) {
  try {
    if (cleanFile(file)) {
      cleanedCount++;
    }
  } catch (error) {
    console.error(`❌ Error cleaning ${file}: ${error.message}`);
  }
}

