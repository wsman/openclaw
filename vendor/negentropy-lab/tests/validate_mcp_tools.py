#!/usr/bin/env python3
"""
MCP工具最佳实践验证脚本
版本: v1.0.0
宪法依据: §303引用完整性公理, §370文件操作标准
开发标准: DS-011 (MCP服务标准实现)
"""

import sys
import os
import re
import json
import ast
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import textwrap

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.absolute()
MCP_TOOLS_DIR = PROJECT_ROOT / "engine" / "mcp_core" / "tools"

# 宪法条款模式
CONSTITUTIONAL_PATTERN = r'§(\d+(?:\.\d+)?)'
# 开发标准模式
STANDARD_PATTERN = r'DS-(\d+)'
# 装饰器模式
DECORATOR_PATTERN = r'@(registry\.register|negetropy_sanitizer)'
# 类定义模式
CLASS_PATTERN = r'class\s+(\w+)'
# 函数定义模式
FUNCTION_PATTERN = r'def\s+(\w+)\s*\('

class ToolValidator:
    """MCP工具验证器"""
    
    def __init__(self, tool_path: Path):
        self.tool_path = tool_path
        self.tool_name = tool_path.stem
        self.content = ""
        self.ast_tree = None
        self.validation_results = {
            "tool_name": self.tool_name,
            "file_path": str(tool_path),
            "file_size": 0,
            "line_count": 0,
            "constitutional_references": [],
            "development_standards": [],
            "has_registry_decorator": False,
            "has_sanitizer_decorator": False,
            "class_count": 0,
            "function_count": 0,
            "has_error_handling": False,
            "has_input_validation": False,
            "has_output_sanitization": False,
            "docstring_present": False,
            "docstring_quality": 0,  # 0-5分
            "mathematical_formulas": [],
            "issues": [],
            "score": 0.0,
            "rating": "⭐"
        }
    
    def read_file(self):
        """读取工具文件内容"""
        try:
            with open(self.tool_path, 'r', encoding='utf-8') as f:
                self.content = f.read()
            self.validation_results["file_size"] = len(self.content)
            self.validation_results["line_count"] = len(self.content.split('\n'))
            return True
        except Exception as e:
            self.validation_results["issues"].append(f"文件读取失败: {e}")
            return False
    
    def parse_ast(self):
        """解析AST语法树"""
        try:
            self.ast_tree = ast.parse(self.content)
            return True
        except Exception as e:
            self.validation_results["issues"].append(f"AST解析失败: {e}")
            return False
    
    def analyze_content(self):
        """分析文件内容"""
        if not self.content:
            return
        
        # 1. 宪法引用分析
        constitutional_matches = re.findall(CONSTITUTIONAL_PATTERN, self.content)
        self.validation_results["constitutional_references"] = list(set([f"§{m}" for m in constitutional_matches]))
        
        # 2. 开发标准分析
        standard_matches = re.findall(STANDARD_PATTERN, self.content)
        self.validation_results["development_standards"] = list(set([f"DS-{m}" for m in standard_matches]))
        
        # 3. 装饰器分析
        decorator_matches = re.findall(DECORATOR_PATTERN, self.content)
        self.validation_results["has_registry_decorator"] = any("registry.register" in d for d in decorator_matches)
        self.validation_results["has_sanitizer_decorator"] = any("negetropy_sanitizer" in d for d in decorator_matches)
        
        # 4. 类定义分析
        class_matches = re.findall(CLASS_PATTERN, self.content)
        self.validation_results["class_count"] = len(class_matches)
        
        # 5. 函数定义分析
        function_matches = re.findall(FUNCTION_PATTERN, self.content)
        self.validation_results["function_count"] = len(function_matches)
        
        # 6. 错误处理分析
        self.validation_results["has_error_handling"] = any(
            keyword in self.content for keyword in ["try:", "except", "catch(", "finally:"]
        )
        
        # 7. 输入验证分析
        self.validation_results["has_input_validation"] = any(
            keyword in self.content.lower() for keyword in ["validate", "validation", "check_input"]
        )
        
        # 8. 输出消毒分析
        self.validation_results["has_output_sanitization"] = any(
            keyword in self.content.lower() for keyword in ["sanitize", "消毒", "clean", "filter"]
        )
        
        # 9. 文档字符串分析
        lines = self.content.split('\n')
        docstring_lines = 0
        in_docstring = False
        docstring_content = []
        
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('"""') or stripped.startswith("'''"):
                if not in_docstring:
                    in_docstring = True
                else:
                    in_docstring = False
                docstring_lines += 1
            elif in_docstring:
                docstring_lines += 1
                docstring_content.append(line)
        
        self.validation_results["docstring_present"] = docstring_lines > 0
        
        # 10. 数学公式分析
        math_patterns = [
            r'\$([^$]+)\$',  # 内联公式
            r'\$\$([^$]+)\$\$',  # 块级公式
            r'\\[a-zA-Z]+\{',  # LaTeX命令
        ]
        math_formulas = []
        for pattern in math_patterns:
            matches = re.findall(pattern, self.content)
            math_formulas.extend(matches)
        self.validation_results["mathematical_formulas"] = math_formulas
    
    def calculate_score(self):
        """计算综合评分"""
        score = 0.0
        max_score = 100.0
        
        # 1. 宪法引用 (25%)
        constitutional_score = min(len(self.validation_results["constitutional_references"]) * 5, 25)
        score += constitutional_score
        
        # 2. 开发标准 (20%)
        standard_score = min(len(self.validation_results["development_standards"]) * 4, 20)
        score += standard_score
        
        # 3. 装饰器使用 (15%)
        decorator_score = 0
        if self.validation_results["has_registry_decorator"]:
            decorator_score += 10
        if self.validation_results["has_sanitizer_decorator"]:
            decorator_score += 5
        score += decorator_score
        
        # 4. 错误处理 (10%)
        if self.validation_results["has_error_handling"]:
            score += 10
        
        # 5. 输入验证 (10%)
        if self.validation_results["has_input_validation"]:
            score += 10
        
        # 6. 输出消毒 (10%)
        if self.validation_results["has_output_sanitization"]:
            score += 10
        
        # 7. 文档完整性 (10%)
        docstring_score = 0
        if self.validation_results["docstring_present"]:
            docstring_score += 5
            # 如果文档行数超过10行，额外加分
            lines = self.content.split('\n')
            docstring_count = sum(1 for line in lines if '"""' in line or "'''" in line)
            if docstring_count >= 4:  # 至少开头和结尾各一对
                docstring_score += 5
        score += docstring_score
        
        self.validation_results["score"] = round(score, 1)
        
        # 转换为星级
        if score >= 90:
            self.validation_results["rating"] = "⭐⭐⭐⭐⭐"
        elif score >= 75:
            self.validation_results["rating"] = "⭐⭐⭐⭐"
        elif score >= 60:
            self.validation_results["rating"] = "⭐⭐⭐"
        elif score >= 40:
            self.validation_results["rating"] = "⭐⭐"
        else:
            self.validation_results["rating"] = "⭐"
    
    def generate_report(self) -> Dict[str, Any]:
        """生成验证报告"""
        self.read_file()
        if self.validation_results["file_size"] > 0:
            self.analyze_content()
            self.calculate_score()
        
        return self.validation_results
    
    def print_summary(self):
        """打印验证摘要"""
        print(f"\n{'='*60}")
        print(f"工具验证: {self.tool_name}")
        print(f"{'='*60}")
        print(f"文件路径: {self.tool_path}")
        print(f"文件大小: {self.validation_results['file_size']} 字节")
        print(f"行数: {self.validation_results['line_count']}")
        print(f"评分: {self.validation_results['score']}/100 {self.validation_results['rating']}")
        print(f"\n关键指标:")
        print(f"  • 宪法引用: {len(self.validation_results['constitutional_references'])} 个")
        if self.validation_results['constitutional_references']:
            print(f"    引用列表: {', '.join(self.validation_results['constitutional_references'])}")
        
        print(f"  • 开发标准: {len(self.validation_results['development_standards'])} 个")
        if self.validation_results['development_standards']:
            print(f"    标准列表: {', '.join(self.validation_results['development_standards'])}")
        
        print(f"  • 注册装饰器: {'✅' if self.validation_results['has_registry_decorator'] else '❌'}")
        print(f"  • 消毒装饰器: {'✅' if self.validation_results['has_sanitizer_decorator'] else '❌'}")
        print(f"  • 错误处理: {'✅' if self.validation_results['has_error_handling'] else '❌'}")
        print(f"  • 输入验证: {'✅' if self.validation_results['has_input_validation'] else '❌'}")
        print(f"  • 输出消毒: {'✅' if self.validation_results['has_output_sanitization'] else '❌'}")
        print(f"  • 文档字符串: {'✅' if self.validation_results['docstring_present'] else '❌'}")
        print(f"  • 类数量: {self.validation_results['class_count']}")
        print(f"  • 函数数量: {self.validation_results['function_count']}")
        print(f"  • 数学公式: {len(self.validation_results['mathematical_formulas'])} 个")
        
        if self.validation_results['issues']:
            print(f"\n发现的问题:")
            for issue in self.validation_results['issues']:
                print(f"  • {issue}")
        
        print(f"\n改进建议:")
        suggestions = []
        if not self.validation_results['has_registry_decorator']:
            suggestions.append("添加 @registry.register() 装饰器")
        if not self.validation_results['has_sanitizer_decorator']:
            suggestions.append("添加 @negetropy_sanitizer 装饰器")
        if not self.validation_results['constitutional_references']:
            suggestions.append("添加宪法引用 (如 §101, §102 等)")
        if not self.validation_results['development_standards']:
            suggestions.append("引用相关开发标准 (如 DS-001, DS-011 等)")
        if not self.validation_results['has_error_handling']:
            suggestions.append("添加 try-except 错误处理机制")
        if not self.validation_results['docstring_present']:
            suggestions.append("添加文档字符串描述工具功能")
        
        if suggestions:
            for suggestion in suggestions:
                print(f"  • {suggestion}")
        else:
            print("  • 无重大改进建议，工具符合最佳实践")

def validate_all_tools():
    """验证所有MCP工具"""
    print("🔍 MCP工具最佳实践全面验证")
    print(f"验证目录: {MCP_TOOLS_DIR}")
    print(f"宪法依据: §303引用完整性公理")
    print(f"开发标准: DS-011 (MCP服务标准实现)")
    print("="*60)
    
    # 获取所有工具文件
    tool_files = []
    for file_path in MCP_TOOLS_DIR.glob("*.py"):
        if file_path.name != "__init__.py" and file_path.name != "base_tool.py":
            tool_files.append(file_path)
    
    print(f"发现 {len(tool_files)} 个MCP工具文件:")
    for i, file_path in enumerate(tool_files, 1):
        print(f"  {i:2d}. {file_path.name}")
    
    print("\n" + "="*60)
    print("开始逐个验证...")
    
    all_results = []
    for tool_file in tool_files:
        validator = ToolValidator(tool_file)
        result = validator.generate_report()
        validator.print_summary()
        all_results.append(result)
    
    # 生成汇总报告
    print("\n" + "="*60)
    print("📊 MCP工具验证汇总报告")
    print("="*60)
    
    # 按评分排序
    all_results.sort(key=lambda x: x["score"], reverse=True)
    
    print("\n工具排名 (按评分降序):")
    print("-"*80)
    print(f"{'排名':<4} {'工具名称':<25} {'评分':<8} {'星级':<10} {'宪法引用':<12} {'开发标准':<12}")
    print("-"*80)
    
    for i, result in enumerate(all_results, 1):
        print(f"{i:<4} {result['tool_name']:<25} {result['score']:<8} {result['rating']:<10} "
              f"{len(result['constitutional_references']):<12} {len(result['development_standards']):<12}")
    
    # 统计信息
    total_tools = len(all_results)
    avg_score = sum(r["score"] for r in all_results) / total_tools if total_tools > 0 else 0
    tools_with_registry = sum(1 for r in all_results if r["has_registry_decorator"])
    tools_with_sanitizer = sum(1 for r in all_results if r["has_sanitizer_decorator"])
    tools_with_constitution = sum(1 for r in all_results if r["constitutional_references"])
    tools_with_standards = sum(1 for r in all_results if r["development_standards"])
    
    print("\n" + "="*60)
    print("📈 总体统计:")
    print("-"*60)
    print(f"• 工具总数: {total_tools}")
    print(f"• 平均评分: {avg_score:.1f}/100")
    print(f"• 使用注册装饰器: {tools_with_registry}/{total_tools} ({tools_with_registry/total_tools*100:.1f}%)")
    print(f"• 使用消毒装饰器: {tools_with_sanitizer}/{total_tools} ({tools_with_sanitizer/total_tools*100:.1f}%)")
    print(f"• 包含宪法引用: {tools_with_constitution}/{total_tools} ({tools_with_constitution/total_tools*100:.1f}%)")
    print(f"• 包含开发标准: {tools_with_standards}/{total_tools} ({tools_with_standards/total_tools*100:.1f}%)")
    
    # 保存详细报告到JSON文件
    report_file = PROJECT_ROOT / "mcp_tools_validation_report.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump({
            "validation_date": "2026-02-11",
            "constitutional_basis": "§303引用完整性公理",
            "development_standard": "DS-011 (MCP服务标准实现)",
            "total_tools": total_tools,
            "average_score": avg_score,
            "detailed_results": all_results
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 详细报告已保存到: {report_file}")
    
    # 识别需要改进的工具
    print("\n" + "="*60)
    print("⚠️ 需要重点关注和改进的工具:")
    print("-"*60)
    
    low_score_tools = [r for r in all_results if r["score"] < 60]
    if low_score_tools:
        for tool in low_score_tools:
            print(f"• {tool['tool_name']} (评分: {tool['score']})")
            if not tool["has_registry_decorator"]:
                print(f"  缺少 @registry.register() 装饰器")
            if not tool["has_sanitizer_decorator"]:
                print(f"  缺少 @negetropy_sanitizer 装饰器")
            if not tool["constitutional_references"]:
                print(f"  缺少宪法引用")
            if not tool["development_standards"]:
                print(f"  缺少开发标准引用")
    else:
        print("• 所有工具评分均超过60分，质量良好！")
    
    print("\n" + "="*60)
    print("✅ MCP工具验证完成")
    print("="*60)

if __name__ == "__main__":
    validate_all_tools()