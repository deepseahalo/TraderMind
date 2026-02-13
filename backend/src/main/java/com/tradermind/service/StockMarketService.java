package com.tradermind.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 股票行情服务
 * 接入新浪财经接口获取实时股票价格
 */
@Service
@Slf4j
public class StockMarketService {

    private final RestTemplate restTemplate;
    private static final String SINA_API_URL = "http://hq.sinajs.cn/list=";
    /** 东方财富搜索 API，支持按股票名称/代码搜索 */
    private static final String EASTMONEY_SEARCH_URL = "https://searchapi.eastmoney.com/api/suggest/get";
    /** 腾讯财经搜索 API */
    private static final String TENCENT_SEARCH_URL = "https://smartbox.gtimg.cn/s3/?v=2&q=";
    /** 新浪财经搜索 API（备用） */
    private static final String SINA_SEARCH_URL = "http://suggest3.sinajs.cn/suggest/type=&key=";
    
    // 匹配新浪返回的格式: var hq_str_sh600519="茅台,1700.00,..."
    private static final Pattern RESPONSE_PATTERN = Pattern.compile("var\\s+hq_str_[^=]+=\"([^\"]+)\"");

    /**
     * 构造函数：配置 RestTemplate 请求头
     */
    public StockMarketService() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * 根据股票代码获取实时价格
     * 
     * @param stockCode 股票代码（如：600519, 000001, AAPL等）
     * @return 当前价格，如果获取失败返回 -1
     */
    public BigDecimal getCurrentPrice(String stockCode) {
        try {
            String prefixedCode = addPrefix(stockCode);
            String url = SINA_API_URL + prefixedCode;
            
            log.debug("请求新浪财经接口: {}", url);
            
            // 设置请求头，避免 403 Forbidden
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Referer", "http://finance.sina.com.cn");
            headers.set("Accept", "*/*");
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<String> responseEntity = restTemplate.exchange(
                url, 
                HttpMethod.GET, 
                entity, 
                String.class
            );
            
            String response = responseEntity.getBody();
            
            if (response == null || response.trim().isEmpty()) {
                log.warn("新浪财经接口返回空响应，股票代码: {}", stockCode);
                return BigDecimal.valueOf(-1);
            }

            // 解析响应
            BigDecimal price = parsePrice(response, stockCode);
            
            if (price.compareTo(BigDecimal.ZERO) < 0) {
                log.warn("解析价格失败，股票代码: {}, 响应: {}", stockCode, response);
            } else {
                log.debug("获取股票 {} 实时价格成功: {}", stockCode, price);
            }
            
            return price;
            
        } catch (HttpClientErrorException.Forbidden e) {
            // 403 Forbidden：可能是接口限制或需要验证
            log.warn("新浪财经接口返回 403 Forbidden，股票代码: {}，可能原因：接口限制或需要验证", stockCode);
            return BigDecimal.valueOf(-1);
        } catch (HttpClientErrorException e) {
            // 其他 HTTP 错误
            log.warn("新浪财经接口返回 HTTP 错误，股票代码: {}，状态码: {}", stockCode, e.getStatusCode());
            return BigDecimal.valueOf(-1);
        } catch (Exception e) {
            log.error("获取股票实时价格异常，股票代码: {}", stockCode, e);
            return BigDecimal.valueOf(-1);
        }
    }

    /**
     * 为股票代码添加新浪财经所需的前缀
     * 
     * 规则：
     * - 6开头（上海主板）-> sh + code (如: sh600519)
     * - 0,3,4,8开头（深圳）-> sz + code (如: sz000001)
     * - 5位数字（香港）-> rt_hk + code
     * - 包含字母（美股）-> gb_ + code（转小写）
     * 
     * @param code 原始股票代码
     * @return 带前缀的代码
     */
    private String addPrefix(String code) {
        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("股票代码不能为空");
        }

        String trimmedCode = code.trim().toUpperCase();
        
        // 如果已经包含前缀，直接返回
        if (trimmedCode.startsWith("sh") || trimmedCode.startsWith("sz") || 
            trimmedCode.startsWith("rt_hk") || trimmedCode.startsWith("gb_")) {
            return trimmedCode.toLowerCase();
        }

        // 纯数字代码
        if (trimmedCode.matches("^\\d+$")) {
            char firstChar = trimmedCode.charAt(0);
            
            if (firstChar == '6') {
                // 上海主板（600xxx, 601xxx, 603xxx, 605xxx等）
                return "sh" + trimmedCode;
            } else if (firstChar == '0' || firstChar == '3' || firstChar == '4' || firstChar == '8') {
                // 深圳（000xxx, 002xxx, 300xxx, 400xxx, 800xxx等）
                return "sz" + trimmedCode;
            } else if (trimmedCode.length() == 5) {
                // 5位数字可能是香港股票
                return "rt_hk" + trimmedCode;
            } else {
                // 其他数字代码，默认按上海处理
                log.warn("未知的数字股票代码格式，默认按上海处理: {}", code);
                return "sh" + trimmedCode;
            }
        } else {
            // 包含字母，视为美股或其他市场
            return "gb_" + trimmedCode.toLowerCase();
        }
    }

    /**
     * 解析新浪财经返回的JavaScript字符串，提取当前价格
     * 
     * 新浪返回格式示例：
     * A股: var hq_str_sh600519="茅台,1700.00,1701.00,1702.00,1703.00,..."
     *      字段顺序: [0]名称, [1]今开, [2]昨收, [3]当前价, [4]最高, [5]最低, ...
     * 
     * 美股: var hq_str_gb_aapl="AAPL,150.00,149.50,..."
     *      字段顺序: [0]名称, [1]当前价, [2]昨收, ...
     * 
     * @param response 新浪财经API响应
     * @param stockCode 股票代码（用于日志）
     * @return 当前价格，解析失败返回 -1
     */
    private BigDecimal parsePrice(String response, String stockCode) {
        try {
            // 使用正则表达式提取引号内的数据
            Matcher matcher = RESPONSE_PATTERN.matcher(response);
            
            if (!matcher.find()) {
                log.warn("无法匹配新浪财经响应格式，股票代码: {}, 响应: {}", stockCode, response);
                return BigDecimal.valueOf(-1);
            }

            String data = matcher.group(1);
            
            // 检查是否返回错误信息
            if (data.contains("FAILED") || data.contains("不存在") || data.trim().isEmpty()) {
                log.warn("新浪财经返回错误信息，股票代码: {}, 响应: {}", stockCode, data);
                return BigDecimal.valueOf(-1);
            }

            // 按逗号分割
            String[] fields = data.split(",");
            
            if (fields.length < 2) {
                log.warn("新浪财经返回数据字段不足，股票代码: {}, 字段数: {}", stockCode, fields.length);
                return BigDecimal.valueOf(-1);
            }

            // 判断是A股还是美股
            String prefixedCode = addPrefix(stockCode);
            BigDecimal price;
            
            if (prefixedCode.startsWith("gb_")) {
                // 美股：当前价在索引 [1]
                price = parseDecimal(fields[1]);
            } else {
                // A股：当前价在索引 [3]
                if (fields.length < 4) {
                    log.warn("A股数据字段不足，股票代码: {}, 字段数: {}", stockCode, fields.length);
                    return BigDecimal.valueOf(-1);
                }
                price = parseDecimal(fields[3]);
            }

            // 验证价格有效性
            if (price.compareTo(BigDecimal.ZERO) <= 0) {
                log.warn("解析出的价格无效，股票代码: {}, 价格: {}", stockCode, price);
                return BigDecimal.valueOf(-1);
            }

            return price.setScale(2, RoundingMode.HALF_UP);
            
        } catch (Exception e) {
            log.error("解析新浪财经响应异常，股票代码: {}", stockCode, e);
            return BigDecimal.valueOf(-1);
        }
    }

    /**
     * 解析字符串为BigDecimal
     * 
     * @param value 字符串值
     * @return BigDecimal，解析失败返回 -1
     */
    private BigDecimal parseDecimal(String value) {
        try {
            if (value == null || value.trim().isEmpty()) {
                return BigDecimal.valueOf(-1);
            }
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            log.warn("解析数字失败: {}", value);
            return BigDecimal.valueOf(-1);
        }
    }

    /**
     * 根据股票代码获取股票信息（代码和名称）
     * 通过调用新浪财经接口验证股票是否存在并获取名称
     * 
     * @param stockCode 股票代码（如：600519, 000001）
     * @return 股票信息，包含代码和名称，如果获取失败返回 null
     */
    public StockInfo getStockInfo(String stockCode) {
        try {
            String prefixedCode = addPrefix(stockCode);
            String url = SINA_API_URL + prefixedCode;
            
            log.debug("请求新浪财经接口获取股票信息: {}", url);
            
            // 设置请求头，避免 403 Forbidden
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Referer", "http://finance.sina.com.cn");
            headers.set("Accept", "*/*");
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<String> responseEntity = restTemplate.exchange(
                url, 
                HttpMethod.GET, 
                entity, 
                String.class
            );
            
            String response = responseEntity.getBody();
            
            if (response == null || response.trim().isEmpty()) {
                log.warn("新浪财经接口返回空响应，股票代码: {}", stockCode);
                return null;
            }

            // 解析响应获取股票名称
            Matcher matcher = RESPONSE_PATTERN.matcher(response);
            
            if (!matcher.find()) {
                log.warn("无法匹配新浪财经响应格式，股票代码: {}", stockCode);
                return null;
            }

            String data = matcher.group(1);
            
            // 检查是否返回错误信息
            if (data.contains("FAILED") || data.contains("不存在") || data.trim().isEmpty()) {
                log.warn("新浪财经返回错误信息，股票代码: {}, 响应: {}", stockCode, data);
                return null;
            }

            // 按逗号分割，第一个字段是股票名称
            String[] fields = data.split(",");
            
            if (fields.length < 1 || fields[0].trim().isEmpty()) {
                log.warn("无法获取股票名称，股票代码: {}", stockCode);
                return null;
            }

            String stockName = fields[0].trim();
            String market = prefixedCode.startsWith("sh") ? "sh" : 
                           prefixedCode.startsWith("sz") ? "sz" : 
                           prefixedCode.startsWith("rt_hk") ? "hk" : "us";
            
            return new StockInfo(stockCode, stockName, market);
            
        } catch (HttpClientErrorException.Forbidden e) {
            log.warn("新浪财经接口返回 403 Forbidden，股票代码: {}", stockCode);
            return null;
        } catch (HttpClientErrorException e) {
            log.warn("新浪财经接口返回 HTTP 错误，股票代码: {}，状态码: {}", stockCode, e.getStatusCode());
            return null;
        } catch (Exception e) {
            log.error("获取股票信息异常，股票代码: {}", stockCode, e);
            return null;
        }
    }

    /**
     * 按关键词搜索股票（名称或代码）
     * 使用东方财富搜索 API，支持全 A 股
     *
     * @param keyword 搜索关键词（如：科华数据、002335）
     * @return 股票信息列表，最多 10 条
     */
    @SuppressWarnings("unchecked")
    public List<StockInfo> searchStocks(String keyword) {
        List<StockInfo> results = new ArrayList<>();
        if (keyword == null || keyword.trim().isEmpty()) {
            return results;
        }
        String trimmed = keyword.trim();
        
        // 方法1：使用腾讯财经搜索 API
        results = tryTencentSearch(trimmed);
        if (!results.isEmpty()) {
            log.info("使用腾讯财经搜索成功，找到 {} 个结果", results.size());
            return results;
        }
        
        // 方法2：使用新浪财经搜索 API
        log.info("腾讯财经搜索未找到结果，尝试新浪财经");
        results = trySinaSearch(trimmed);
        if (!results.isEmpty()) {
            log.info("使用新浪财经搜索成功，找到 {} 个结果", results.size());
            return results;
        }
        
        // 方法3：使用基于代码范围的搜索（当 API 不可用时的备用方案）
        log.info("外部 API 搜索失败，使用代码范围搜索");
        results = searchByCodeRange(trimmed);
        if (!results.isEmpty()) {
            log.info("使用代码范围搜索成功，找到 {} 个结果", results.size());
            return results;
        }
        
        // 方法4：尝试东方财富 API（最后备用）
        log.info("代码范围搜索未找到结果，尝试东方财富 API");
        results = trySearchStocks(trimmed, 14);
        
        return results;
    }
    
    /**
     * 基于股票代码范围的搜索（当外部 API 不可用时的备用方案）
     * 通过遍历常见的股票代码范围来查找匹配的股票
     */
    private List<StockInfo> searchByCodeRange(String keyword) {
        List<StockInfo> results = new ArrayList<>();
        String lowerKeyword = keyword.toLowerCase();
        
        // 如果输入的是数字，尝试作为代码搜索
        if (keyword.matches("^\\d+$")) {
            // 尝试常见的代码范围
            String[] prefixes = {"600", "601", "603", "605", "000", "001", "002", "300"};
            for (String prefix : prefixes) {
                if (keyword.startsWith(prefix) || prefix.startsWith(keyword)) {
                    // 尝试生成可能的代码
                    for (int i = 0; i < 100 && results.size() < 10; i++) {
                        String code = String.format("%s%03d", prefix, i);
                        if (code.length() == 6) {
                            StockInfo info = getStockInfo(code);
                            if (info != null && info.getName().toLowerCase().contains(lowerKeyword)) {
                                results.add(info);
                            }
                        }
                    }
                }
            }
        } else {
            // 按名称搜索：遍历常见的股票代码范围
            // 沪市：600000-605999
            for (int code = 600000; code <= 601999 && results.size() < 10; code++) {
                StockInfo info = getStockInfo(String.valueOf(code));
                if (info != null && info.getName().contains(keyword)) {
                    results.add(info);
                }
            }
            
            // 如果还没找到足够的，继续搜索其他范围
            if (results.size() < 10) {
                // 深市主板：000001-002999
                for (int code = 1; code <= 2999 && results.size() < 10; code++) {
                    String codeStr = String.format("%06d", code);
                    StockInfo info = getStockInfo(codeStr);
                    if (info != null && info.getName().contains(keyword)) {
                        results.add(info);
                    }
                }
            }
        }
        
        return results;
    }
    
    /**
     * 使用腾讯财经搜索 API
     * 格式: var v_hint=["600519~贵州茅台~sh600519","000001~平安银行~sz000001"]
     */
    private List<StockInfo> tryTencentSearch(String keyword) {
        List<StockInfo> results = new ArrayList<>();
        try {
            // 尝试不同的 URL 格式
            String[] urls = {
                TENCENT_SEARCH_URL + java.net.URLEncoder.encode(keyword, "UTF-8") + "&t=all",
                TENCENT_SEARCH_URL + java.net.URLEncoder.encode(keyword, "UTF-8"),
                "https://smartbox.gtimg.cn/s3/?v=2&q=" + java.net.URLEncoder.encode(keyword, "UTF-8") + "&t=all&c=1"
            };
            
            for (String url : urls) {
                log.info("尝试腾讯财经搜索 API URL: {}", url);
                
                HttpHeaders headers = new HttpHeaders();
                headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                headers.set("Referer", "https://finance.qq.com/");
                headers.set("Accept", "*/*");
                HttpEntity<String> entity = new HttpEntity<>(headers);
                
                try {
                    ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
                    String body = response.getBody();
                    
                    if (body == null || body.isEmpty()) {
                        log.warn("腾讯财经搜索 API 响应为空，URL: {}", url);
                        continue;
                    }
                    
                    log.info("腾讯财经搜索 API 响应 (前500字符): {}", body.length() > 500 ? body.substring(0, 500) : body);
                    
                    // 解析实际格式: v_hint="sz~002022~\u79d1\u534e\u751f\u7269~khsw~GP-A^sz~002335~\u79d1\u534e\u6570\u636e~khsj~GP-A^..."
                    // 格式: 市场~代码~名称(Unicode)~拼音~类型^市场~代码~名称~拼音~类型^...
                    if (body.contains("v_hint=")) {
                        // 提取引号内的内容
                        int start = body.indexOf("\"");
                        int end = body.lastIndexOf("\"");
                        if (start >= 0 && end > start) {
                            String content = body.substring(start + 1, end);
                            log.info("提取的内容: {}", content.length() > 200 ? content.substring(0, 200) + "..." : content);
                            
                            // 使用 ^ 分割各个股票项
                            String[] items = content.split("\\^");
                            log.info("分割后的项目数: {}", items.length);
                            
                            for (String item : items) {
                                if (item.trim().isEmpty()) continue;
                                
                                // 格式: sz~002022~\u79d1\u534e\u751f\u7269~khsw~GP-A
                                String[] parts = item.split("~");
                                if (parts.length >= 3) {
                                    String marketCode = parts[0].trim(); // sz 或 sh
                                    String code = parts[1].trim(); // 002022
                                    String nameUnicode = parts[2].trim(); // \u79d1\u534e\u751f\u7269
                                    
                                    // 解码 Unicode 字符
                                    String name = decodeUnicode(nameUnicode);
                                    
                                    log.debug("解析股票: market={}, code={}, name={}", marketCode, code, name);
                                    
                                    // 确定市场
                                    String market = marketCode.equals("sz") ? "sz" : "sh";
                                    
                                    // 只返回 A 股（6位数字代码，排除科创板688和创业板300）
                                    if (code.matches("^[0-9]{6}$") && !code.startsWith("688") && !code.startsWith("300")) {
                                        results.add(new StockInfo(code, name, market));
                                        log.info("添加搜索结果: {} {} ({})", code, name, market);
                                        if (results.size() >= 10) break;
                                    }
                                }
                            }
                            
                            if (!results.isEmpty()) {
                                return results;
                            }
                        }
                    }
                    
                    // 兼容旧格式: var v_hint=["600519~贵州茅台~sh600519","000001~平安银行~sz000001"];
                    if (body.contains("var v_hint=") && body.contains("[")) {
                        int start = body.indexOf("[");
                        int end = body.lastIndexOf("]");
                        if (start >= 0 && end > start) {
                            String jsonArray = body.substring(start, end + 1);
                            jsonArray = jsonArray.replaceAll("\"", "").replace("\\", "");
                            
                            String[] items = jsonArray.substring(1, jsonArray.length() - 1).split(",");
                            for (String item : items) {
                                item = item.trim();
                                if (item.isEmpty()) continue;
                                
                                String[] parts = item.split("~");
                                if (parts.length >= 3) {
                                    String code = parts[0].trim();
                                    String name = parts[1].trim();
                                    String fullCode = parts[2].trim();
                                    
                                    String market = fullCode.startsWith("sz") ? "sz" : "sh";
                                    if (code.matches("^[0-9]{6}$")) {
                                        results.add(new StockInfo(code, name, market));
                                        if (results.size() >= 10) break;
                                    }
                                }
                            }
                            
                            if (!results.isEmpty()) {
                                return results;
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("腾讯财经搜索请求失败，URL: {}, error: {}", url, e.getMessage());
                    continue;
                }
            }
        } catch (Exception e) {
            log.error("腾讯财经搜索失败，keyword={}", keyword, e);
        }
        return results;
    }
    
    /**
     * 使用新浪财经搜索 API
     */
    private List<StockInfo> trySinaSearch(String keyword) {
        List<StockInfo> results = new ArrayList<>();
        try {
            String url = SINA_SEARCH_URL + java.net.URLEncoder.encode(keyword, "UTF-8");
            log.info("新浪财经搜索 API URL: {}", url);
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            String body = response.getBody();
            
            if (body == null || body.isEmpty()) {
                log.warn("新浪财经搜索 API 响应为空");
                return results;
            }
            
            log.info("新浪财经搜索 API 响应: {}", body);
            
            // 解析新浪财经返回格式: var suggestvalue="600519,贵州茅台,sh600519,600519";
            // 格式: 代码,名称,完整代码,代码
            if (body.startsWith("var suggestvalue=\"")) {
                String content = body.substring("var suggestvalue=\"".length());
                if (content.endsWith("\";")) {
                    content = content.substring(0, content.length() - 2);
                }
                
                String[] lines = content.split(";");
                for (String line : lines) {
                    if (line.trim().isEmpty()) continue;
                    String[] parts = line.split(",");
                    if (parts.length >= 3) {
                        String code = parts[0].trim();
                        String name = parts[1].trim();
                        String fullCode = parts[2].trim();
                        
                        // 确定市场
                        String market = "sh";
                        if (fullCode.startsWith("sz")) {
                            market = "sz";
                        } else if (fullCode.startsWith("sh")) {
                            market = "sh";
                        } else if (code.startsWith("0") || code.startsWith("3")) {
                            market = "sz";
                        } else if (code.startsWith("6")) {
                            market = "sh";
                        }
                        
                        // 只返回 A 股
                        if (code.matches("^[0-9]{6}$")) {
                            results.add(new StockInfo(code, name, market));
                            if (results.size() >= 10) break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("新浪财经搜索失败，keyword={}", keyword, e);
        }
        return results;
    }
    
    @SuppressWarnings("unchecked")
    private List<StockInfo> trySearchStocks(String keyword, Integer type) {
        List<StockInfo> results = new ArrayList<>();
        try {
            // 构建 URL，确保参数格式正确
            StringBuilder urlBuilder = new StringBuilder(EASTMONEY_SEARCH_URL);
            urlBuilder.append("?input=").append(java.net.URLEncoder.encode(keyword, "UTF-8"));
            if (type != null) {
                urlBuilder.append("&type=").append(type);
            }
            urlBuilder.append("&count=20");
            String url = urlBuilder.toString();
            log.info("搜索股票 API URL: {}", url);
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Referer", "https://www.eastmoney.com/");
            headers.set("Accept", "application/json, text/plain, */*");
            headers.set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            Map<String, Object> body = response.getBody();
            
            log.info("搜索股票 API 响应状态: {}", response.getStatusCode());
            log.info("搜索股票 API 响应体: {}", body);
            
            if (body == null) {
                log.warn("搜索股票 API 响应体为空");
                return results;
            }

            // 尝试不同的响应格式
            // 格式1: QuotationCodeTable.Data
            Object qct = body.get("QuotationCodeTable");
            if (qct instanceof Map) {
                Map<String, Object> table = (Map<String, Object>) qct;
                Object data = table.get("Data");
                if (data instanceof List) {
                    log.info("找到 QuotationCodeTable.Data 字段");
                    return parseStockData((List<?>) data);
                }
            }
            
            // 格式2: 直接 Data
            Object data = body.get("Data");
            if (data instanceof List) {
                log.info("找到 Data 字段（直接）");
                return parseStockData((List<?>) data);
            }
            
            // 格式3: QuotationCodeTable 可能是数组
            if (qct instanceof List) {
                log.info("QuotationCodeTable 是 List 类型");
                return parseStockData((List<?>) qct);
            }
            
            // 格式4: 尝试其他可能的字段
            for (String key : body.keySet()) {
                Object value = body.get(key);
                if (value instanceof List) {
                    log.info("尝试解析字段: {}", key);
                    List<StockInfo> parsed = parseStockData((List<?>) value);
                    if (!parsed.isEmpty()) {
                        return parsed;
                    }
                } else if (value instanceof Map) {
                    Map<String, Object> map = (Map<String, Object>) value;
                    Object mapData = map.get("Data");
                    if (mapData instanceof List) {
                        log.info("在字段 {} 中找到 Data", key);
                        return parseStockData((List<?>) mapData);
                    }
                }
            }
            
            log.warn("未找到有效的数据字段，响应体键: {}", body.keySet());
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            // 400/404 等客户端错误，记录但不抛出异常，继续尝试其他方法
            log.warn("搜索股票 API 返回错误，keyword={}, type={}, status={}, body={}", 
                    keyword, type, e.getStatusCode(), e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("搜索股票失败，keyword={}, type={}", keyword, type, e);
        }
        return results;
    }
    
    /**
     * 解码 Unicode 字符串
     * 例如: \u79d1\u534e\u751f\u7269 -> 科华生物
     */
    private String decodeUnicode(String unicodeStr) {
        if (unicodeStr == null || !unicodeStr.contains("\\u")) {
            return unicodeStr;
        }
        
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < unicodeStr.length()) {
            if (unicodeStr.charAt(i) == '\\' && i + 5 < unicodeStr.length() && unicodeStr.charAt(i + 1) == 'u') {
                try {
                    String hex = unicodeStr.substring(i + 2, i + 6);
                    int codePoint = Integer.parseInt(hex, 16);
                    sb.append((char) codePoint);
                    i += 6;
                } catch (NumberFormatException e) {
                    sb.append(unicodeStr.charAt(i));
                    i++;
                }
            } else {
                sb.append(unicodeStr.charAt(i));
                i++;
            }
        }
        return sb.toString();
    }
    
    @SuppressWarnings("unchecked")
    private List<StockInfo> parseStockData(List<?> data) {
        List<StockInfo> results = new ArrayList<>();
        log.info("解析股票数据，数量: {}", data.size());
        
        for (Object item : data) {
            if (!(item instanceof Map)) {
                log.warn("数据项不是 Map 类型: {}", item != null ? item.getClass() : "null");
                continue;
            }
            Map<String, Object> row = (Map<String, Object>) item;
            String code = String.valueOf(row.getOrDefault("Code", ""));
            String name = String.valueOf(row.getOrDefault("Name", ""));
            String typeName = String.valueOf(row.getOrDefault("SecurityTypeName", ""));
            
            log.debug("解析股票项: Code={}, Name={}, SecurityTypeName={}", code, name, typeName);
            
            if (code.isEmpty() || "null".equals(code)) {
                log.warn("股票代码为空，跳过该项");
                continue;
            }

            String market = typeName.contains("沪") ? "sh" : typeName.contains("深") ? "sz" : "sh";
            results.add(new StockInfo(code, name, market));
            log.info("添加搜索结果: {} {} ({})", code, name, market);
            if (results.size() >= 10) break;
        }
        
        log.info("解析完成，返回 {} 个结果", results.size());
        return results;
    }

    /**
     * 股票信息内部类
     */
    public static class StockInfo {
        private final String code;
        private final String name;
        private final String market;

        public StockInfo(String code, String name, String market) {
            this.code = code;
            this.name = name;
            this.market = market;
        }

        public String getCode() {
            return code;
        }

        public String getName() {
            return name;
        }

        public String getMarket() {
            return market;
        }
    }
}
