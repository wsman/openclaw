# DS-019: 可视化熵减标准实现 (Visual Entropy Reduction)

**父索引**: [Development Standards Index](../DEVELOPMENT_STANDARDS.md)
**对应技术法**: §361
**宪法依据**: §122 (质量门控与标准)
**版本**: v5.5.0 (Dual-Store Isomorphism)
**状态**: 🟢 生产就绪

---

**对应技术法条款**: §361
**宪法依据**: §153 (视觉宪法公理), §395 (视觉熵减检查)
**适用场景**: 前端页面开发、组件设计、视觉复杂度控制

### 问题背景
前端UI的视觉熵（视觉复杂度）过高会导致用户认知负荷增加，降低用户体验和操作效率。未经控制的视觉熵会导致界面混乱和维护困难。

### 强制标准
所有前端页面开发必须遵循可视化熵减原则，确保视觉复杂度可控，CSS文件数量不超过2个（1个设计系统 + 1个专用样式）。

### 数学基础
视觉熵 $H_v$ 的计算公式：
$$
H_v = -\sum_{i=1}^{n} p_i \log_2 p_i
$$
其中 $p_i$ 表示第 $i$ 个视觉元素（颜色、间距、字体等）在界面中出现的相对频率。

### 标准实现模式

#### 1. CSS文件数量控制
```html
<!-- ✅ 符合标准: 2个CSS文件 -->
<link rel="stylesheet" href="css/design-system.css">
<link rel="stylesheet" href="css/supervision.css">

<!-- ❌ 违反标准: 超过2个CSS文件 -->
<link rel="stylesheet" href="css/design-system.css">
<link rel="stylesheet" href="css/supervision.css">
<link rel="stylesheet" href="css/common.css"> <!-- 禁止模糊命名 -->
<link rel="stylesheet" href="css/style.css">   <!-- 禁止通用命名 -->
```

#### 2. 组件熵减设计模式
```css
/* ✅ 符合标准: 使用CSS变量继承设计系统 */
.entropy-reduced-component {
    background: var(--color-bg-panel);
    border: var(--border-thin);
    padding: var(--spacing-md);
    color: var(--color-text-main);
}

/* ❌ 违反标准: 硬编码样式 */
.high-entropy-component {
    background: #000005;  /* 硬编码颜色 */
    border: 1px solid #00ff00;
    padding: 16px;
    color: #00ff00;
}
```

#### 3. 视觉复杂度测量函数 (JavaScript)
```javascript
/**
 * 计算页面视觉熵值
 * @returns {Object} 熵值报告
 */
function measureVisualEntropy() {
    const elements = document.querySelectorAll('*');
    const styleStats = {};
    let totalElements = elements.length;
    
    // 收集样式统计
    elements.forEach(el => {
        const computedStyle = window.getComputedStyle(el);
        const color = computedStyle.color;
        const fontSize = computedStyle.fontSize;
        const margin = computedStyle.margin;
        
        const styleKey = `${color}-${fontSize}-${margin}`;
        styleStats[styleKey] = (styleStats[styleKey] || 0) + 1;
    });
    
    // 计算熵值
    let entropy = 0;
    Object.values(styleStats).forEach(count => {
        const probability = count / totalElements;
        entropy -= probability * Math.log2(probability);
    });
    
    return {
        entropy: entropy,
        elementCount: totalElements,
        uniqueStyleCount: Object.keys(styleStats).length,
        recommendation: entropy > 3 ? '视觉熵过高，建议简化设计' : '视觉熵在合理范围'
    };
}
```

#### 4. 自动熵减重构工具 (Python)
```python
def refactor_css_for_entropy_reduction(css_content: str, design_system_vars: dict) -> str:
    """
    重构CSS代码以降低视觉熵
    将硬编码值替换为设计系统变量
    """
    import re
    
    # 颜色替换映射
    color_replacements = {
        '#000005': 'var(--color-bg-deep)',
        '#00ff00': 'var(--color-primary)',
        '#0088ff': 'var(--color-accent)',
        '#ffaa00': 'var(--color-warning)',
        '#ff4444': 'var(--color-danger)',
        'rgba(0, 255, 0, 0.5)': 'var(--color-primary-dim)',
        'rgba(0, 255, 0, 0.2)': 'var(--color-primary-glow)'
    }
    
    # 间距替换映射
    spacing_replacements = {
        '4px': 'var(--spacing-xs)',
        '8px': 'var(--spacing-sm)',
        '16px': 'var(--spacing-md)',
        '24px': 'var(--spacing-lg)',
        '32px': 'var(--spacing-xl)'
    }
    
    # 应用替换
    refactored_css = css_content
    for old, new in color_replacements.items():
        refactored_css = refactored_css.replace(old, new)
    
    for old, new in spacing_replacements.items():
        # 仅替换作为独立值的间距（避免替换其他数字中的部分）
        pattern = r'(?<![\.\d])' + re.escape(old) + r'(?![\.\d])'
        refactored_css = re.sub(pattern, new, refactored_css)
    
    return refactored_css
```

### 熵减验证流程

1. **设计阶段验证**:
   - 检查设计稿是否使用设计系统令牌
   - 计算设计稿的视觉熵值 $H_v < 2.5$

2. **开发阶段验证**:
   - 运行 `measureVisualEntropy()` 确保 $H_v < 3.0$
   - 检查CSS文件数量 ≤ 2
   - 禁止硬编码颜色和间距

3. **部署前验证**:
   - 自动运行CSS重构工具
   - 生成视觉熵报告
   - 不符合标准则阻塞部署

### 监控指标
- `visual_entropy_score`: 视觉熵值（应 < 3.0）
- `css_file_count`: CSS文件数量（应 ≤ 2）
- `hardcoded_style_violations`: 硬编码样式违规次数
- `design_system_coverage`: 设计系统覆盖率（应 > 90%）

### 验证方法
1. 在浏览器控制台运行 `measureVisualEntropy()`
2. 检查HTML中引入的CSS文件数量
3. 扫描CSS文件中的硬编码值
4. 计算设计系统变量的使用比例

---
