"""Bounded, versioned public rule metadata; no transaction material or network."""
from __future__ import annotations
from importlib.resources import files
import json
import re
from .client import ZerynexError


def parse_rule_catalog(raw: str) -> dict[str, object]:
    if not isinstance(raw,str) or not 0 < len(raw) < 32 * 1024:
        raise ZerynexError('Invalid local rule catalog size.')
    try:
        def no_duplicates(pairs):
            record={}
            for key,value in pairs:
                if key in record:
                    raise ValueError('duplicate keys')
                record[key]=value
            return record
        data=json.loads(raw, object_pairs_hook=no_duplicates)
        if (not isinstance(data,dict) or set(data) != {'schema_version','tool','rule_set_version','scope','rules'} or
                type(data['schema_version']) is not int or data['schema_version'] != 1 or
                data['tool'] != 'zerynex' or not isinstance(data['rule_set_version'],str) or
                not re.fullmatch(r'[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}', data['rule_set_version']) or
                not isinstance(data['scope'],str) or not 20 < len(data['scope']) <= 512):
            raise ValueError
        rules=data['rules']
        if not isinstance(rules,list) or not 1 <= len(rules) <= 32:
            raise ValueError
        ids=[]
        for rule in rules:
            if (not isinstance(rule,dict) or set(rule) != {'id','title','severity','category','applies_to','summary'} or
                    not all(isinstance(rule[x],str) for x in ('id','title','severity','category','summary')) or
                    not re.fullmatch(r'PCZT-[A-Z-]{3,64}',rule['id']) or
                    not 5 <= len(rule['title']) <= 120 or not 10 <= len(rule['summary']) <= 256 or
                    rule['category'] not in ('metadata','pool_policy','handoff','regression') or
                    rule['severity'] not in ('warning','error') or
                    not isinstance(rule['applies_to'],list) or
                    rule['applies_to'] not in (['stage_comparison'],['analysis','stage_comparison'])):
                raise ValueError
            ids.append(rule['id'])
        if ids != sorted(set(ids)) or any(not item.startswith('PCZT-') for item in ids):
            raise ValueError
        return data
    except (ValueError,TypeError,KeyError):
        raise ZerynexError('Invalid rule catalog from the local Rust engine.') from None


def bundled_rule_catalog() -> dict[str, object]:
    """Read the packaged metadata snapshot (validated during release CI)."""
    try:
        raw=files('zerynex_py').joinpath('fixtures','rule-catalog.json').read_bytes()
        return parse_rule_catalog(raw.decode('utf-8'))
    except (OSError,UnicodeError,ValueError):
        raise ZerynexError('Bundled rule catalog is unavailable.') from None
