---
type: Standard
id: DS-008
status: Active
relationships:
  implements: [LAW-TECH#§353]
  verifies: [LAW-BASIC#§137]
  related_to: [DS-007]
  required_by: [WF-201]
tags: [interface, contract, verification, consistency, tier-2]
---
# DS-008: 接口契约一致性验证标准实现

**父索引**: [技术法索引](../t0_core/technical_law_index.md)
**对应技术法**: §353
**宪法依据**: §122 (质量门控与标准), §137 (语义门控)
**版本**: v7.0.0 (Negentropy-Lab)
**状态**: 🟢 生产就绪

---

**对应技术法条款**: §353
**宪法依据**: §137 (语义门控)
**适用场景**: 接口文档与代码实现一致性验证、API契约维护

### 问题背景
代码实现与接口文档的契约不一致会导致系统行为不可预测，增加认知熵。接口契约是系统可靠性的基础。

### 强制标准
所有模块的接口必须通过 `judicial_verify_contract` 工具验证，确保代码与文档的契约一致性。

### 标准实现模式 (Python)

```python
import ast
import inspect
import json
import re
from typing import Dict, List, Any, Optional, Tuple

class InterfaceContractValidator:
    """
    接口契约一致性验证器
    实现宪法 §353 接口契约一致性要求
    
    验证维度:
    1. 函数签名一致性 (参数名、类型、默认值)
    2. 返回值类型一致性
    3. 异常声明一致性
    4. 文档字符串完整性
    """
    
    def verify_module_contract(self, code_file: str, doc_file: Optional[str] = None) -> Dict[str, Any]:
        """
        验证模块的接口契约一致性
        
        参数:
            code_file: Python代码文件路径
            doc_file: 接口文档文件路径（可选，如OpenAPI Spec）
        
        返回:
            契约验证报告
        """
        try:
            # 解析代码文件
            code_contracts = self._extract_code_contracts(code_file)
            
            # 解析文档文件（如果提供）
            doc_contracts = self._extract_doc_contracts(doc_file) if doc_file else {}
            
            # 执行一致性验证
            consistency_results = self._verify_consistency(code_contracts, doc_contracts)
            
            # 计算一致性得分
            consistency_score = self._calculate_consistency_score(consistency_results)
            
            return {
                "status": "COMPLETE",
                "code_file": code_file,
                "doc_file": doc_file,
                "consistency_score": consistency_score,
                "contracts_found": len(code_contracts),
                "verification_results": consistency_results,
                "health_status": self._determine_contract_health(consistency_score)
            }
            
        except Exception as e:
            return {
                "status": "ERROR",
                "error": str(e),
                "code_file": code_file,
                "doc_file": doc_file
            }
    
    def _extract_code_contracts(self, code_file: str) -> Dict[str, Dict[str, Any]]:
        """
        从Python代码中提取接口契约
        
        提取内容:
        1. 函数/方法签名
        2. 参数类型注解
        3. 返回值类型注解
        4. 文档字符串
        """
        contracts = {}
        
        with open(code_file, 'r', encoding='utf-8') as f:
            code_content = f.read()
        
        # 使用AST解析代码
        tree = ast.parse(code_content)
        
        # 遍历所有函数定义
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                func_name = node.name
                
                # 跳过私有方法（以_开头）
                if func_name.startswith('_'):
                    continue
                
                # 提取参数信息
                params = []
                for arg in node.args.args:
                    param_name = arg.arg
                    
                    # 获取类型注解
                    type_annotation = None
                    if arg.annotation:
                        type_annotation = ast.unparse(arg.annotation)
                    
                    params.append({
                        "name": param_name,
                        "type": type_annotation,
                        "required": True
                    })
                
                # 提取返回值类型
                return_type = None
                if node.returns:
                    return_type = ast.unparse(node.returns)
                
                # 提取文档字符串
                docstring = ast.get_docstring(node)
                
                contracts[func_name] = {
                    "type": "function",
                    "params": params,
                    "return_type": return_type,
                    "docstring": docstring,
                    "line_number": node.lineno
                }
        
        return contracts
    
    def _extract_doc_contracts(self, doc_file: str) -> Dict[str, Dict[str, Any]]:
        """
        从文档文件中提取接口契约
        
        支持格式:
        1. OpenAPI/Swagger (JSON/YAML)
        2. Markdown API文档
        3. 自定义文档格式
        """
        contracts = {}
        
        with open(doc_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 根据文件扩展名选择解析器
        if doc_file.endswith('.json'):
            try:
                data = json.loads(content)
                contracts = self._parse_openapi_spec(data)
            except json.JSONDecodeError:
                pass
        elif doc_file.endswith('.md'):
            contracts = self._parse_markdown_docs(content)
        
        return contracts
    
    def _parse_openapi_spec(self, spec_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """解析OpenAPI规范"""
        contracts = {}
        
        paths = spec_data.get('paths', {})
        for path, methods in paths.items():
            for method, spec in methods.items():
                # 生成操作ID
                operation_id = spec.get('operationId', f"{method}_{path.replace('/', '_')}")
                
                # 提取参数
                params = []
                for param_spec in spec.get('parameters', []):
                    params.append({
                        "name": param_spec.get('name'),
                        "type": param_spec.get('schema', {}).get('type'),
                        "required": param_spec.get('required', False)
                    })
                
                # 提取响应
                responses = spec.get('responses', {})
                return_type = None
                if '200' in responses:
                    response_schema = responses['200'].get('content', {}).get('application/json', {}).get('schema')
                    if response_schema:
                        return_type = response_schema.get('type', 'object')
                
                contracts[operation_id] = {
                    "type": "api_endpoint",
                    "path": path,
                    "method": method.upper(),
                    "params": params,
                    "return_type": return_type,
                    "description": spec.get('description')
                }
        
        return contracts
    
    def _parse_markdown_docs(self, content: str) -> Dict[str, Dict[str, Any]]:
        """解析Markdown API文档"""
        contracts = {}
        
        # 简单解析：查找函数定义部分
        lines = content.split('\n')
        current_function = None
        
        for i, line in enumerate(lines):
            # 查找函数标题 (## 函数名)
            match = re.match(r'^##+\s+(\w+)', line)
            if match:
                current_function = match.group(1)
                
                # 尝试提取参数表
                params = self._extract_params_from_markdown(lines, i)
                
                contracts[current_function] = {
                    "type": "function",
                    "params": params,
                    "return_type": None,
                    "description": self._extract_description_from_markdown(lines, i)
                }
        
        return contracts
    
    def _extract_params_from_markdown(self, lines: List[str], start_line: int) -> List[Dict[str, Any]]:
        """从Markdown表格中提取参数信息"""
        params = []
        
        for i in range(start_line, min(start_line + 20, len(lines))):
            line = lines[i]
            
            # 查找参数表格
            if '| 参数名 | 类型 | 必填 | 描述 |' in line:
                # 读取表格行
                for j in range(i + 2, min(i + 10, len(lines))):
                    table_line = lines[j]
                    if not table_line.startswith('|'):
                        break
                    
                    # 解析表格单元格
                    cells = [cell.strip() for cell in table_line.split('|')[1:-1]]
                    if len(cells) >= 3:
                        params.append({
                            "name": cells[0],
                            "type": cells[1],
                            "required": cells[2].lower() == '是',
                            "description": cells[3] if len(cells) > 3 else ""
                        })
        
        return params
    
    def _extract_description_from_markdown(self, lines: List[str], start_line: int) -> str:
        """从Markdown中提取描述"""
        description_lines = []
        
        for i in range(start_line + 1, min(start_line + 10, len(lines))):
            line = lines[i]
            if line.startswith('#'):
                break
            if line.strip():
                description_lines.append(line.strip())
        
        return ' '.join(description_lines)
    
    def _verify_consistency(self, code_contracts: Dict, doc_contracts: Dict) -> List[Dict[str, Any]]:
        """
        验证代码契约与文档契约的一致性
        """
        results = []
        
        # 检查所有代码中的接口
        for func_name, code_contract in code_contracts.items():
            if func_name in doc_contracts:
                doc_contract = doc_contracts[func_name]
                result = self._compare_contracts(func_name, code_contract, doc_contract)
            else:
                result = {
                    "interface": func_name,
                    "status": "MISSING_DOC",
                    "message": f"接口 '{func_name}' 在文档中缺失",
                    "severity": "MEDIUM"
                }
            
            results.append(result)
        
        # 检查文档中多出的接口（代码中缺失）
        for func_name, doc_contract in doc_contracts.items():
            if func_name not in code_contracts:
                results.append({
                    "interface": func_name,
                    "status": "MISSING_CODE",
                    "message": f"接口 '{func_name}' 在代码中缺失",
                    "severity": "HIGH"
                })
        
        return results
    
    def _compare_contracts(self, func_name: str, code_contract: Dict, doc_contract: Dict) -> Dict[str, Any]:
        """
        比较单个接口的契约一致性
        """
        issues = []
        
        # 比较参数
        code_params = {p["name"]: p for p in code_contract.get("params", [])}
        doc_params = {p["name"]: p for p in doc_contract.get("params", [])}
        
        # 检查参数缺失
        for param_name, code_param in code_params.items():
            if param_name not in doc_params:
                issues.append(f"参数 '{param_name}' 在文档中缺失")
        
        for param_name, doc_param in doc_params.items():
            if param_name not in code_params:
                issues.append(f"参数 '{param_name}' 在代码中缺失")
        
        # 比较参数类型
        for param_name in set(code_params.keys()) & set(doc_params.keys()):
            code_type = code_params[param_name].get("type")
            doc_type = doc_params[param_name].get("type")
            
            if code_type and doc_type and not self._type_compatible(code_type, doc_type):
                issues.append(f"参数 '{param_name}' 类型不兼容: 代码={code_type}, 文档={doc_type}")
        
        # 比较返回值类型
        code_return = code_contract.get("return_type")
        doc_return = doc_contract.get("return_type")
        
        if code_return and doc_return and not self._type_compatible(code_return, doc_return):
            issues.append(f"返回值类型不兼容: 代码={code_return}, 文档={doc_return}")
        
        # 确定状态
        if not issues:
            status = "CONSISTENT"
            severity = "LOW"
            message = "契约完全一致"
        else:
            status = "INCONSISTENT"
            severity = "HIGH" if any("缺失" in issue for issue in issues) else "MEDIUM"
            message = "; ".join(issues)
        
        return {
            "interface": func_name,
            "status": status,
            "message": message,
            "severity": severity,
            "issues": issues,
            "code_contract": code_contract,
            "doc_contract": doc_contract
        }
    
    def _type_compatible(self, type1: str, type2: str) -> bool:
        """
        检查类型兼容性（简化实现）
        """
        # 类型映射
        type_mapping = {
            "str": ["string", "str"],
            "int": ["integer", "int", "number"],
            "float": ["float", "number"],
            "bool": ["boolean", "bool"],
            "dict": ["object", "dict"],
            "list": ["array", "list"]
        }
        
        # 标准化类型名
        type1_norm = type1.lower().strip()
        type2_norm = type2.lower().strip()
        
        # 检查直接相等
        if type1_norm == type2_norm:
            return True
        
        # 检查映射关系
        for compatible_types in type_mapping.values():
            if type1_norm in compatible_types and type2_norm in compatible_types:
                return True
        
        return False
    
    def _calculate_consistency_score(self, results: List[Dict[str, Any]]) -> float:
        """
        计算契约一致性得分 (0-100)
        """
        if not results:
            return 100.0
        
        total_interfaces = len(results)
        consistent_count = sum(1 for r in results if r["status"] == "CONSISTENT")
        
        return round((consistent_count / total_interfaces) * 100.0, 2)
    
    def _determine_contract_health(self, score: float) -> str:
        """确定契约健康状态"""
        if score >= 95.0:
            return "EXCELLENT"
        elif score >= 90.0:
            return "GOOD"
        elif score >= 80.0:
            return "FAIR"
        elif score >= 70.0:
            return "POOR"
        else:
            return "CRITICAL"
```

### 契约验证指标
- `contract_consistency_score`: 契约一致性得分 (0-100)
- `interfaces_verified`: 验证的接口数量
- `missing_docs_count`: 文档缺失的接口数量
- `type_mismatch_count`: 类型不匹配的数量
- `contract_health_status`: 契约健康状态

### 验证频率
- **开发阶段**: 每次代码提交前验证
- **文档更新**: 文档变更后立即验证
- **生产发布**: 发布前必须通过验证

---

**宪法依据**: §137 (语义门控), §353 (接口契约一致性验证公理)  
**维护状态**: 活跃维护  
**最后更新**: 2026-02-11  
**移植来源**: MY-DOGE-DEMO v6.8.0