# -*- coding: utf-8 -*-
"""
i18n messages for the backend.
All strings use Unicode escapes to avoid encoding issues.
"""

LANG = 'zh'

_messages = {
    'zh': {
        'missing_data': '\u8bf7\u63d0\u4f9b\u767b\u5f55\u4fe1\u606f',  # 请提供登录信息
        'missing_user_id': '\u8bf7\u8f93\u5165\u5de5\u53f7',  # 请输入工号
        'user_not_found': '\u5de5\u53f7\u4e0d\u5b58\u5728',  # 工号不存在
        'not_logged_in': '\u672a\u767b\u5f55',  # 未登录
        'token_expired': '\u767b\u5f55\u5df2\u8fc7\u671f',  # 登录已过期
        'invalid_token': '\u65e0\u6548\u7684\u767b\u5f55\u51ed\u8bc1',  # 无效的登录凭证
        'no_permission': '\u65e0\u6743\u9650',  # 无权限
        'ticket_not_found': '\u5de5\u5355\u4e0d\u5b58\u5728',  # 工单不存在
        'ticket_already_claimed': '\u8be5\u5de5\u5355\u5df2\u88ab\u63a5\u5355\u6216\u5df2\u5b8c\u6210',  # 该工单已被接单或已完成
        'ticket_not_processing': '\u8be5\u5de5\u5355\u672a\u5728\u5904\u7406\u4e2d',  # 该工单未在处理中
        'not_your_ticket': '\u53ea\u80fd\u5b8c\u6210\u81ea\u5df1\u63a5\u5355\u7684\u5de5\u5355',  # 只能完成自己接单的工单
        'missing_fields': '\u8bf7\u586b\u5199\u8054\u7cfb\u65b9\u5f0f\u3001\u4f4d\u7f6e\u548c\u6545\u969c\u7c7b\u578b',  # 请填写联系方式、位置和故障类型
        'invalid_category': '\u65e0\u6548\u7684\u6545\u969c\u7c7b\u578b',  # 无效的故障类型
        'provide_users': '\u8bf7\u63d0\u4f9b\u7528\u6237\u6570\u636e',  # 请提供用户数据
        'empty_users': '\u7528\u6237\u6570\u636e\u4e0d\u80fd\u4e3a\u7a7a',  # 用户数据不能为空
        'incomplete_user': '\u4fe1\u606f\u4e0d\u5b8c\u6574',  # 信息不完整
        'category_network_down': '\u7f51\u7edc\u4e0d\u901a',  # 网络不通
        'category_slow_speed': '\u7f51\u901f\u6162',  # 网速慢
        'category_device_fault': '\u8bbe\u5907\u6545\u969c',  # 设备故障
        'category_other': '\u5176\u4ed6',  # 其他
        'status_pending': '\u5f85\u63a5\u5355',  # 待接单
        'status_processing': '\u5904\u7406\u4e2d',  # 处理中
        'status_resolved': '\u5df2\u89e3\u51b3',  # 已解决
        'csv_header': [
            '\u5de5\u5355\u53f7', '\u62a5\u4fee\u4eba', '\u62a5\u4fee\u4eba\u5de5\u53f7',
            '\u8054\u7cfb\u65b9\u5f0f',
            '\u4f4d\u7f6e', '\u6545\u969c\u7c7b\u578b', '\u63cf\u8ff0',
            '\u63a5\u5355\u4eba', '\u534f\u4f5c\u8005', '\u63a5\u5355\u4eba\u5b66\u53f7', '\u5904\u7406\u65b9\u6848', '\u63d0\u4ea4\u65f6\u95f4', '\u5b8c\u6210\u65f6\u95f4', '\u72b6\u6001'
        ],
    },
    'en': {
        'missing_data': 'Please provide login info',
        'missing_user_id': 'Please enter your ID',
        'user_not_found': 'ID not found',
        'not_logged_in': 'Not logged in',
        'token_expired': 'Login expired',
        'invalid_token': 'Invalid credentials',
        'no_permission': 'Access denied',
        'ticket_not_found': 'Ticket not found',
        'ticket_already_claimed': 'Ticket already claimed or completed',
        'ticket_not_processing': 'Ticket is not in processing',
        'not_your_ticket': 'Can only complete your own tickets',
        'missing_fields': 'Contact, location and category are required',
        'invalid_category': 'Invalid fault category',
        'provide_users': 'Please provide user data',
        'empty_users': 'User list cannot be empty',
        'incomplete_user': 'Incomplete user info',
        'category_network_down': 'Network Down',
        'category_slow_speed': 'Slow Speed',
        'category_device_fault': 'Device Fault',
        'category_other': 'Other',
        'status_pending': 'Pending',
        'status_processing': 'Processing',
        'status_resolved': 'Resolved',
        'csv_header': ['ID', 'Reporter', 'Reporter ID', 'Contact', 'Location', 'Category', 'Description', 'Assignee', 'Assignee ID', 'Solution', 'Created', 'Completed', 'Status'],
    }
}


def t(key):
    return _messages[LANG].get(key, key)
