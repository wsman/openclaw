---
type: Standard
id: DS-009
status: Active
relationships:
  implements: [LAW-TECH#§354]
  verifies: [LAW-BASIC#§141]
  related_to: [DS-007]
  required_by: [WF-201]
tags: [complexity, measurement, quality, tier-1]
---
# DS-009: 圈复杂度测量标准实现

**父索引**: [技术法索引](../t0_core/technical_law_index.md)
**对应技术法**: §354
**宪法依据**: §122 (质量门控与标准), §141 (自动化重构安全)
**版本**: v7.0.0 (Negentropy-Lab)
**状态**: 🟢 生产就绪

---

**对应技术法条款**: §354
**宪法依据**: §141 (自动化重构安全)
**适用场景**: 代码质量评估、重构优先级确定、熵减验证

### 问题背景
代码圈复杂度 V(G) 过高会导致维护成本增加和熵增，违反熵减原则。高复杂度代码是技术债务的主要来源。

### 强制标准
所有代码变更必须通过 `judicial_measure_complexity` 工具测量圈复杂度，确保 V(G) ≤ 10。

### 标准实现模式 (Python)

```python
import ast
import math
from typing import Dict, List, Any, Tuple

class CyclomaticComplexityAnalyzer:
    """
    圈复杂度分析器
    实现宪法 §354 圈复杂度测量标准
    
    圈复杂度 V(G) = E - N + 2P
    其中:
    - E: 控制流图中的边数
    - N: 控制流图中的节点数  
    - P: 连通分量数（通常为1）
    
    简化计算: V(G) = 基础复杂度 + 决策点计数
    """
    
    def measure_complexity(self, file_path: str) -> Dict[str, Any]:
        """
        测量文件的圈复杂度
        
        参数:
            file_path: 代码文件路径
        
        返回:
            复杂度分析报告
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                code_content = f.read()
            
            # 解析AST
            tree = ast.parse(code_content)
            
            # 收集复杂度数据
            complexity_data = self._analyze_ast(tree)
            
            # 计算总体复杂度
            overall_complexity = self._calculate_overall_complexity(complexity_data)
            
            # 识别高复杂度函数
            high_complexity_functions = self._identify_high_complexity_functions(complexity_data)
            
            # 生成重构建议
            recommendations = self._generate_recommendations(complexity_data, high_complexity_functions)
            
            return {
                "status": "COMPLETE",
                "file_path": file_path,
                "overall_complexity": overall_complexity,
                "function_count": len(complexity_data["functions"]),
                "complexity_distribution": complexity_data["distribution"],
                "high_complexity_functions": high_complexity_functions,
                "recommendations": recommendations,
                "compliance_status": self._check_compliance(overall_complexity, high_complexity_functions)
            }
            
        except Exception as e:
            return {
                "status": "ERROR",
                "error": str(e),
                "file_path": file_path
            }
    
    def _analyze_ast(self, tree: ast.AST) -> Dict[str, Any]:
        """
        分析AST树，收集复杂度信息
        """
        functions = []
        distribution = {
            "low": 0,      # V(G) ≤ 5
            "medium": 0,   # 5 < V(G) ≤ 10
            "high": 0,     # 10 < V(G) ≤ 15
            "critical": 0  # V(G) > 15
        }
        
        # 遍历所有节点
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                func_complexity = self._calculate_function_complexity(node)
                
                functions.append({
                    "name": node.name,
                    "line_number": node.lineno,
                    "complexity": func_complexity,
                    "decision_points": self._count_decision_points(node),
                    "lines_of_code": self._count_lines_of_code(node)
                })
                
                # 更新分布
                if func_complexity <= 5:
                    distribution["low"] += 1
                elif func_complexity <= 10:
                    distribution["medium"] += 1
                elif func_complexity <= 15:
                    distribution["high"] += 1
                else:
                    distribution["critical"] += 1
        
        return {
            "functions": functions,
            "distribution": distribution
        }
    
    def _calculate_function_complexity(self, func_node: ast.FunctionDef) -> int:
        """
        计算单个函数的圈复杂度
        
        简化公式: V(G) = 1 + 决策点数量
        决策点包括: if, for, while, try, except, and, or
        """
        complexity = 1  # 基础复杂度
        
        for node in ast.walk(func_node):
            # if 语句
            if isinstance(node, ast.If):
                complexity += 1
                # elif 分支
                complexity += len(node.orelse) if isinstance(node.orelse, list) else 0
            
            # for/while 循环
            elif isinstance(node, (ast.For, ast.While)):
                complexity += 1
            
            # try 语句
            elif isinstance(node, ast.Try):
                complexity += 1
                # except 分支
                complexity += len(node.handlers)
                # finally 分支
                if node.finalbody:
                    complexity += 1
            
            # and/or 逻辑运算符（短路评估）
            elif isinstance(node, ast.BoolOp):
                # and/or 会创建决策点
                complexity += len(node.values) - 1
            
            # 三元表达式
            elif isinstance(node, ast.IfExp):
                complexity += 1
        
        return complexity
    
    def _count_decision_points(self, func_node: ast.FunctionDef) -> List[str]:
        """统计决策点类型"""
        decision_points = []
        
        for node in ast.walk(func_node):
            if isinstance(node, ast.If):
                decision_points.append("if")
            elif isinstance(node, ast.For):
                decision_points.append("for")
            elif isinstance(node, ast.While):
                decision_points.append("while")
            elif isinstance(node, ast.Try):
                decision_points.append("try")
            elif isinstance(node, ast.BoolOp):
                decision_points.append("bool_op")
            elif isinstance(node, ast.IfExp):
                decision_points.append("if_exp")
        
        return decision_points
    
    def _count_lines_of_code(self, func_node: ast.FunctionDef) -> int:
        """计算函数行数"""
        if not func_node.body:
            return 1
        
        # 获取起始行和结束行
        start_line = func_node.lineno
        end_line = func_node.end_lineno if hasattr(func_node, 'end_lineno') else start_line
        
        return end_line - start_line + 1
    
    def _calculate_overall_complexity(self, complexity_data: Dict[str, Any]) -> Dict[str, Any]:
        """计算总体复杂度指标"""
        functions = complexity_data["functions"]
        
        if not functions:
            return {
                "average": 0.0,
                "max": 0,
                "min": 0,
                "median": 0.0,
                "standard_deviation": 0.0
            }
        
        complexities = [f["complexity"] for f in functions]
        
        # 计算平均值
        avg_complexity = sum(complexities) / len(complexities)
        
        # 计算中位数
        sorted_complexities = sorted(complexities)
        mid = len(sorted_complexities) // 2
        if len(sorted_complexities) % 2 == 0:
            median_complexity = (sorted_complexities[mid-1] + sorted_complexities[mid]) / 2
        else:
            median_complexity = sorted_complexities[mid]
        
        # 计算标准差
        if len(complexities) > 1:
            variance = sum((x - avg_complexity) ** 2 for x in complexities) / (len(complexities) - 1)
            std_dev = math.sqrt(variance)
        else:
            std_dev = 0.0
        
        return {
            "average": round(avg_complexity, 2),
            "max": max(complexities),
            "min": min(complexities),
            "median": round(median_complexity, 2),
            "standard_deviation": round(std_dev, 2)
        }
    
    def _identify_high_complexity_functions(self, complexity_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """识别高复杂度函数"""
        high_complexity = []
        
        for func in complexity_data["functions"]:
            if func["complexity"] > 10:  # 宪法标准: V(G) ≤ 10
                high_complexity.append({
                    "name": func["name"],
                    "complexity": func["complexity"],
                    "line_number": func["line_number"],
                    "decision_points": func["decision_points"],
                    "lines_of_code": func["lines_of_code"],
                    "priority": self._determine_refactor_priority(func["complexity"])
                })
        
        # 按复杂度降序排序
        high_complexity.sort(key=lambda x: x["complexity"], reverse=True)
        
        return high_complexity
    
    def _determine_refactor_priority(self, complexity: int) -> str:
        """确定重构优先级"""
        if complexity > 20:
            return "CRITICAL"
        elif complexity > 15:
            return "HIGH"
        elif complexity > 10:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _generate_recommendations(self, complexity_data: Dict[str, Any], 
                                 high_complexity_functions: List[Dict[str, Any]]) -> List[str]:
        """生成重构建议"""
        recommendations = []
        
        # 总体建议
        distribution = complexity_data["distribution"]
        total_functions = sum(distribution.values())
        
        if total_functions > 0:
            critical_percentage = (distribution["critical"] / total_functions) * 100
            high_percentage = (distribution["high"] / total_functions) * 100
            
            if critical_percentage > 10:
                recommendations.append(f"🔴 严重: {critical_percentage:.1f}%的函数复杂度>15，需要紧急重构")
            if high_percentage > 20:
                recommendations.append(f"🟡 警告: {high_percentage:.1f}%的函数复杂度>10，建议优先重构")
        
        # 具体函数建议
        for func in high_complexity_functions[:5]:  # 只显示前5个
            recommendations.append(
                f"📋 {func['name']} (行{func['line_number']}): "
                f"复杂度={func['complexity']}, "
                f"决策点={len(func['decision_points'])}个, "
                f"优先级={func['priority']}"
            )
        
        if not high_complexity_functions:
            recommendations.append("🟢 优秀: 所有函数复杂度均符合宪法标准 (V(G) ≤ 10)")
        
        return recommendations
    
    def _check_compliance(self, overall_complexity: Dict[str, Any], 
                         high_complexity_functions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """检查宪法合规性"""
        # 检查平均复杂度
        avg_complexity = overall_complexity["average"]
        max_complexity = overall_complexity["max"]
        
        # 宪法标准: V(G) ≤ 10
        avg_compliant = avg_complexity <= 10
        max_compliant = max_complexity <= 10
        
        # 计算合规得分
        if max_complexity == 0:
            compliance_score = 100.0
        else:
            # 基于最高复杂度的惩罚
            max_penalty = max(0, max_complexity - 10) * 5  # 每超出1点扣5分
            compliance_score = max(0, 100 - max_penalty)
        
        return {
            "avg_complexity_compliant": avg_compliant,
            "max_complexity_compliant": max_compliant,
            "high_complexity_functions_count": len(high_complexity_functions),
            "compliance_score": round(compliance_score, 2),
            "constitutional_standard": "V(G) ≤ 10",
            "is_constitutional": max_compliant and avg_compliant
        }
```

### 复杂度测量指标
- `average_complexity`: 平均圈复杂度
- `max_complexity`: 最大圈复杂度
- `complexity_distribution`: 复杂度分布统计
- `high_complexity_functions`: 高复杂度函数列表
- `compliance_score`: 宪法合规得分 (0-100)

### 合规标准
- **宪法底线**: 所有函数 V(G) ≤ 10
- **优秀标准**: 平均 V(G) ≤ 5
- **紧急阈值**: 存在 V(G) > 15 的函数

### 监控频率
- **开发环境**: 每次代码提交前测量
- **代码审查**: 作为必审项
- **生产环境**: 每周定期扫描

---

**宪法依据**: §141 (自动化重构安全), §354 (圈复杂度测量公理)  
**维护状态**: 活跃维护  
**最后更新**: 2026-02-11  
**移植来源**: MY-DOGE-DEMO v6.8.0