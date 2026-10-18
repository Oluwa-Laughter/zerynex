//! ZIP-321 ZEC payment-request validation and formatting (local-only).
//! No signing, payment authorization, broadcast, wallet access, or HTTP.
//! Custom assets are explicitly unsupported, never silently misclassified.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    str::FromStr,
};
use zcash_address::{ConversionError, TryFromAddress, ZcashAddress};
use zcash_protocol::consensus::NetworkType;

const MAX_URI: usize = 16 * 1024;
const MAX_PAYMENTS: usize = 32;
const MAX_PARAMS: usize = 128;
const MAX_TEXT: usize = 256;
const MAX_ZAT: u64 = 2_100_000_000_000_000;
const LIMITATION: &str = "ZIP-321 syntax and address-encoding checks; no spend authorization, receiver selection, wallet support, proof, broadcast, or settlement verification.";

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PaymentNetwork {
    Main,
    Test,
    Regtest,
}
impl PaymentNetwork {
    pub fn parse(s: &str) -> Result<Self, &'static str> {
        match s {
            "main" => Ok(Self::Main),
            "test" => Ok(Self::Test),
            "regtest" => Ok(Self::Regtest),
            _ => Err("Invalid expected payment network"),
        }
    }
    fn network(self) -> NetworkType {
        match self {
            Self::Main => NetworkType::Main,
            Self::Test => NetworkType::Test,
            Self::Regtest => NetworkType::Regtest,
        }
    }
}

struct SupportedAddress;
impl TryFromAddress for SupportedAddress {
    type Error = &'static str;
    fn try_from_sapling(_: NetworkType, _: [u8; 43]) -> Result<Self, ConversionError<Self::Error>> {
        Ok(Self)
    }
    fn try_from_unified(
        _: NetworkType,
        _: zcash_address::unified::Address,
    ) -> Result<Self, ConversionError<Self::Error>> {
        Ok(Self)
    }
    fn try_from_transparent_p2pkh(
        _: NetworkType,
        _: [u8; 20],
    ) -> Result<Self, ConversionError<Self::Error>> {
        Ok(Self)
    }
    fn try_from_transparent_p2sh(
        _: NetworkType,
        _: [u8; 20],
    ) -> Result<Self, ConversionError<Self::Error>> {
        Ok(Self)
    }
    fn try_from_tex(_: NetworkType, _: [u8; 20]) -> Result<Self, ConversionError<Self::Error>> {
        Ok(Self)
    }
}
fn address_type(value: &str, network: PaymentNetwork) -> Result<&'static str, &'static str> {
    if value.len() > 512 || value.is_empty() || !value.bytes().all(|x| x.is_ascii_alphanumeric()) {
        return Err("Invalid ZIP-321 address characters");
    }
    let parsed = ZcashAddress::from_str(value)
        .map_err(|_| "Invalid Zcash recipient address encoding or checksum")?;
    let memo = parsed.can_receive_memo();
    let transparent = parsed.is_transparent_only();
    parsed
        .convert_if_network::<SupportedAddress>(network.network())
        .map_err(|_| "Unsupported, Sprout, or incorrect-network recipient address")?;
    Ok(if transparent {
        "transparent"
    } else if memo {
        "shielded_or_unified"
    } else {
        "other"
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaymentItem {
    pub index: u32,
    pub address: String,
    pub address_type: String,
    pub amount_zat: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memo_base64url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaymentRequest {
    pub schema_version: u32,
    pub network: PaymentNetwork,
    pub payments: Vec<PaymentItem>,
    pub limitation: &'static str,
}
#[derive(Debug, Clone, Serialize)]
pub struct PaymentSummary {
    pub schema_version: u32,
    pub network: PaymentNetwork,
    pub payments: Vec<PaymentSafeItem>,
    pub total_zat: Option<u64>,
    pub limitation: &'static str,
}
#[derive(Debug, Clone, Serialize)]
pub struct PaymentSafeItem {
    pub index: u32,
    pub address_type: String,
    pub amount_zat: Option<u64>,
    pub memo_present: bool,
    pub label_present: bool,
    pub message_present: bool,
}
impl PaymentRequest {
    pub fn summary(&self) -> PaymentSummary {
        PaymentSummary {
            schema_version: 1,
            network: self.network,
            payments: self
                .payments
                .iter()
                .map(|x| PaymentSafeItem {
                    index: x.index,
                    address_type: x.address_type.clone(),
                    amount_zat: x.amount_zat,
                    memo_present: x.memo_base64url.is_some(),
                    label_present: x.label.is_some(),
                    message_present: x.message.is_some(),
                })
                .collect(),
            total_zat: self
                .payments
                .iter()
                .try_fold(0u64, |sum, p| sum.checked_add(p.amount_zat?)),
            limitation: LIMITATION,
        }
    }
}
fn parse_zat(value: &str) -> Result<u64, &'static str> {
    let (whole, frac) = value
        .split_once('.')
        .map_or((value, None), |(w, f)| (w, Some(f)));
    if whole.is_empty()
        || !whole.bytes().all(|x| x.is_ascii_digit())
        || frac
            .is_some_and(|f| f.is_empty() || f.len() > 8 || !f.bytes().all(|x| x.is_ascii_digit()))
        || value.len() > 64
    {
        return Err("Invalid ZIP-321 ZEC decimal amount");
    }
    let whole = whole
        .parse::<u64>()
        .map_err(|_| "ZIP-321 amount exceeds ZEC supply")?;
    let base = whole
        .checked_mul(100_000_000)
        .ok_or("ZIP-321 amount exceeds ZEC supply")?;
    let fraction = frac.map_or(0, |v| {
        v.parse::<u64>().unwrap_or(0) * 10u64.pow((8 - v.len()) as u32)
    });
    let sum = base
        .checked_add(fraction)
        .ok_or("ZIP-321 amount exceeds ZEC supply")?;
    if sum > MAX_ZAT {
        return Err("ZIP-321 amount exceeds ZEC supply");
    }
    Ok(sum)
}
fn quote_decode(value: &str) -> Result<String, &'static str> {
    // RFC3986 qchar. No raw `?`, `#`, `&`, `=`, slash, or whitespace.
    let src = value.as_bytes();
    let mut buf = Vec::with_capacity(src.len());
    let mut i = 0;
    while i < src.len() {
        let b = src[i];
        if b == b'%' {
            if i + 2 >= src.len() {
                return Err("Invalid ZIP-321 percent encoding");
            }
            let parse_hex = |x: u8| -> Option<u8> {
                match x {
                    b'0'..=b'9' => Some(x - b'0'),
                    b'a'..=b'f' => Some(x - b'a' + 10),
                    b'A'..=b'F' => Some(x - b'A' + 10),
                    _ => None,
                }
            };
            buf.push(
                parse_hex(src[i + 1]).ok_or("Invalid ZIP-321 percent encoding")? * 16
                    + parse_hex(src[i + 2]).ok_or("Invalid ZIP-321 percent encoding")?,
            );
            i += 3;
            continue;
        }
        if !b.is_ascii_alphanumeric() && !b"-._~!$'()*+,;:@".contains(&b) {
            return Err("Invalid ZIP-321 label or message characters");
        }
        buf.push(b);
        i += 1;
    }
    if buf.len() > MAX_TEXT {
        return Err("ZIP-321 text field exceeds size limit");
    }
    String::from_utf8(buf).map_err(|_| "Invalid ZIP-321 UTF-8 text")
}
fn quote_encode(src: &str) -> String {
    let mut out = String::new();
    for b in src.as_bytes() {
        if b.is_ascii_alphanumeric() || b"-._~!$'()*+,;:@".contains(b) {
            out.push(*b as char)
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}
fn memo_validate(src: &str) -> Result<(), &'static str> {
    if src.len() > 683
        || src.len() % 4 == 1
        || !src
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Invalid ZIP-321 unpadded base64url memo");
    }
    let decoded = URL_SAFE_NO_PAD
        .decode(src)
        .map_err(|_| "Invalid ZIP-321 memo encoding")?;
    if decoded.len() > 512 {
        return Err("ZIP-321 memo exceeds 512 bytes");
    }
    if URL_SAFE_NO_PAD.encode(&decoded) != src {
        return Err("Invalid ZIP-321 canonical memo encoding");
    }
    Ok(())
}
fn index_key(key: &str) -> Result<(&str, u32), &'static str> {
    let (field, idx) = match key.split_once('.') {
        Some((key, n)) => {
            if n.is_empty()
                || n.len() > 4
                || n.starts_with('0')
                || !n.bytes().all(|b| b.is_ascii_digit())
            {
                return Err("Invalid ZIP-321 parameter index");
            }
            (
                key,
                n.parse::<u32>()
                    .map_err(|_| "Invalid ZIP-321 parameter index")?,
            )
        }
        None => (key, 0),
    };
    if field.is_empty()
        || !field.as_bytes()[0].is_ascii_alphabetic()
        || !field
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'+')
    {
        return Err("Invalid ZIP-321 query parameter key");
    }
    Ok((field, idx))
}
/// Parse the current ZEC subset of ZIP-321 and check recipient checksums/network.
/// `req-asset` fails closed until full ZIP-227 semantics can be verified.
pub fn parse_zip321(uri: &str, network: PaymentNetwork) -> Result<PaymentRequest, &'static str> {
    if uri.len() > MAX_URI || uri.len() < 7 || !uri.starts_with("zcash:") {
        return Err("Invalid ZIP-321 scheme or length");
    }
    let value = &uri[6..];
    let (path, query) = value.split_once('?').map_or((value, ""), |(p, q)| (p, q));
    if path.is_empty() && query.is_empty() {
        return Err("ZIP-321 request requires an address");
    }
    if !path.is_empty() && !path.bytes().all(|b| b.is_ascii_alphanumeric()) {
        return Err("Invalid ZIP-321 address component");
    }
    let mut params: BTreeMap<u32, BTreeMap<String, String>> = BTreeMap::new();
    if !path.is_empty() {
        params
            .entry(0)
            .or_default()
            .insert("address".into(), path.into());
    }
    if !query.is_empty() {
        if query.split('&').count() > MAX_PARAMS {
            return Err("ZIP-321 query has too many parameters");
        }
        for part in query.split('&') {
            if part.is_empty() {
                return Err("Empty ZIP-321 query parameter");
            }
            let (raw, value) = part
                .split_once('=')
                .ok_or("Invalid ZIP-321 parameter assignment")?;
            let (field, idx) = index_key(raw)?;
            if field.starts_with("req-") {
                return Err("Unsupported required ZIP-321 parameter or custom asset");
            }
            if !["address", "amount", "memo", "label", "message"].contains(&field) {
                // Keep unknown optional parameters grouped to enforce indexes and duplication.
                quote_decode(value)?;
                if params
                    .entry(idx)
                    .or_default()
                    .insert(field.into(), value.into())
                    .is_some()
                {
                    return Err("Duplicate ZIP-321 indexed parameter");
                }
                continue;
            }
            match field {
                "address" => {
                    if value.is_empty() || !value.bytes().all(|b| b.is_ascii_alphanumeric()) {
                        return Err("Invalid ZIP-321 recipient address");
                    }
                }
                "amount" => {
                    parse_zat(value)?;
                }
                "memo" => {
                    memo_validate(value)?;
                }
                _ => {
                    quote_decode(value)?;
                }
            }
            if params
                .entry(idx)
                .or_default()
                .insert(field.into(), value.into())
                .is_some()
            {
                return Err("Duplicate ZIP-321 indexed parameter");
            }
        }
    }
    if params.len() > MAX_PAYMENTS || params.is_empty() {
        return Err("ZIP-321 payment count out of range");
    }
    let mut payments = Vec::with_capacity(params.len());
    for (index, entry) in params {
        let address = entry
            .get("address")
            .ok_or("ZIP-321 payment missing indexed address")?;
        let ty = address_type(address, network)?;
        let memo = entry.get("memo").cloned();
        if memo.is_some() && ty == "transparent" {
            return Err("ZIP-321 memo cannot target a transparent address");
        }
        payments.push(PaymentItem {
            index,
            address: address.clone(),
            address_type: ty.into(),
            amount_zat: entry.get("amount").map(|v| parse_zat(v)).transpose()?,
            memo_base64url: memo,
            label: entry.get("label").map(|v| quote_decode(v)).transpose()?,
            message: entry.get("message").map(|v| quote_decode(v)).transpose()?,
        });
    }
    Ok(PaymentRequest {
        schema_version: 1,
        network,
        payments,
        limitation: LIMITATION,
    })
}
/// Format a previously validated request, rejecting tampered payment metadata.
pub fn format_zip321(request: &PaymentRequest) -> Result<String, &'static str> {
    if request.payments.is_empty() || request.payments.len() > MAX_PAYMENTS {
        return Err("ZIP-321 payment count out of range");
    }
    let mut used = BTreeSet::new();
    let mut pairs = Vec::new();
    for item in &request.payments {
        if item.index > 9999 || !used.insert(item.index) {
            return Err("Duplicate or invalid ZIP-321 payment index");
        }
        address_type(&item.address, request.network)?;
        if item.memo_base64url.is_some() && item.address_type == "transparent" {
            return Err("Transparent recipients cannot carry memos");
        }
        let suffix = if item.index == 0 {
            "".to_owned()
        } else {
            format!(".{}", item.index)
        };
        pairs.push(format!("address{suffix}={}", item.address));
        if let Some(amount) = item.amount_zat {
            if amount > MAX_ZAT {
                return Err("ZIP-321 amount exceeds ZEC supply");
            }
            let whole = amount / 100_000_000;
            let frac = amount % 100_000_000;
            let val = if frac == 0 {
                whole.to_string()
            } else {
                format!("{}.{:08}", whole, frac)
                    .trim_end_matches('0')
                    .to_string()
            };
            pairs.push(format!("amount{suffix}={val}"));
        }
        if let Some(memo) = &item.memo_base64url {
            memo_validate(memo)?;
            pairs.push(format!("memo{suffix}={memo}"))
        }
        for (field, val) in [
            ("label", item.label.as_deref()),
            ("message", item.message.as_deref()),
        ] {
            if let Some(val) = val {
                if val.len() > MAX_TEXT {
                    return Err("ZIP-321 label or message too large");
                }
                pairs.push(format!("{field}{suffix}={}", quote_encode(val)));
            }
        }
    }
    let uri = format!("zcash:?{}", pairs.join("&"));
    parse_zip321(&uri, request.network)?;
    Ok(uri)
}

#[cfg(test)]
mod tests {
    use super::*;
    const TEST_T: &str = "tmEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU";
    const TEST_S: &str =
        "ztestsapling10yy2ex5dcqkclhc7z7yrnjq2z6feyjad56ptwlfgmy77dmaqqrl9gyhprdx59qgmsnyfska2kez";
    const MAIN_T: &str = "t1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs";
    #[test]
    fn official_zip321_single_and_multi_payment_vectors() {
        let one=format!("zcash:{TEST_S}?amount=1&memo=VGhpcyBpcyBhIHNpbXBsZSBtZW1vLg&message=Thank%20you%20for%20your%20purchase");
        let parsed = parse_zip321(&one, PaymentNetwork::Test).unwrap();
        assert_eq!(parsed.payments.len(), 1);
        assert_eq!(parsed.payments[0].amount_zat, Some(100_000_000));
        assert_eq!(
            parsed.payments[0].message.as_deref(),
            Some("Thank you for your purchase")
        );
        assert!(!serde_json::to_string(&parsed.summary())
            .unwrap()
            .contains(TEST_S));
        assert_eq!(parsed.summary().total_zat, Some(100_000_000));
        let multi=format!("zcash:?address={TEST_T}&amount=123.456&address.1={TEST_S}&amount.1=0.789&memo.1=VGhpcyBpcyBhIHVuaWNvZGUgbWVtbyDinKjwn6aE8J-PhvCfjok");
        let result = parse_zip321(&multi, PaymentNetwork::Test).unwrap();
        assert_eq!(result.payments[0].amount_zat, Some(12_345_600_000));
        assert_eq!(result.payments[1].amount_zat, Some(78_900_000));
        assert_eq!(result.summary().total_zat, Some(12_424_500_000));
        let regenerated = format_zip321(&result).unwrap();
        assert_eq!(
            parse_zip321(&regenerated, PaymentNetwork::Test).unwrap(),
            result
        );
        assert!(parse_zip321(&format!("zcash:{MAIN_T}?amount=1"), PaymentNetwork::Test).is_err());
        assert!(parse_zip321(&format!("zcash:{MAIN_T}?amount=1"), PaymentNetwork::Main).is_ok());
    }
    #[test]
    fn official_invalid_examples_and_malicious_input_fail_closed() {
        let invalid = [
            format!("zcash:?amount=1&address.1={TEST_S}"),
            format!("zcash:?address={TEST_T}&amount.1=2"),
            format!("zcash:?address.0={TEST_S}&amount.0=2"),
            format!("zcash:{TEST_T}?amount=1&amount=2"),
            format!("zcash:{TEST_T}?amount=1%30"),
            format!("zcash:{TEST_T}?%61mount=1"),
            format!("zcash:%74{TEST_T}?amount=1"),
            format!("zcash://{TEST_T}?amount=1"),
            format!("zcash:{TEST_T}?memo=VGhpcyBpcyBhIHNpbXBsZSBtZW1vLg"),
            format!("zcash:{TEST_S}?amount=5&req-asset=not@valid!chars"),
            format!("zcash:{TEST_S}?req-new-wallet-action=1"),
            format!("zcash:{TEST_S}?amount=0.123456789"),
            format!("zcash:{TEST_S}?amount=50."),
            format!("zcash:{TEST_S}?amount=.5"),
            format!("zcash:{TEST_S}?amount=21000000.00000001"),
            format!("zcash:{TEST_S}?memo=AA=="),
            format!("zcash:{TEST_S}?label=%GG"),
            format!("zcash:{TEST_S}?message=%FF"),
            format!("zcash:{TEST_S}?amount.10000=1"),
            format!("zcash:{TEST_S}?amount.01=1"),
            format!("zcash:{TEST_S}?amount=1&"),
            format!("zcash:{TEST_S}?message=wallet#secret"),
            format!(
                "zcash:{TEST_S}?memo={}",
                URL_SAFE_NO_PAD.encode(vec![55u8; 513])
            ),
            format!("zcash:{}?amount=1", "ztestsapling1"),
            format!("zcash:{TEST_S}?address={TEST_S}"),
        ];
        for item in invalid {
            assert!(
                parse_zip321(&item, PaymentNetwork::Test).is_err(),
                "incorrectly accepted {item}"
            );
        }
        assert!(parse_zip321(
            &format!("zcash:{TEST_S}?label=Hello%20world"),
            PaymentNetwork::Test
        )
        .is_ok());
        assert!(parse_zip321(
            &format!("zcash:{TEST_S}?unknown=discarded"),
            PaymentNetwork::Test
        )
        .is_ok());
    }
    #[test]
    fn amounts_round_trip_without_floating_point_or_metadata_leak() {
        for (decimal, zat) in [
            ("0", 0),
            ("0.00000001", 1),
            ("050.00", 5_000_000_000),
            ("0000.500", 50_000_000),
            ("21000000", MAX_ZAT),
        ] {
            let original =
                format!("zcash:{TEST_S}?amount={decimal}&label=Test%20label&message=Hello%20world");
            let parsed = parse_zip321(&original, PaymentNetwork::Test).unwrap();
            assert_eq!(parsed.payments[0].amount_zat, Some(zat));
            let rebuilt = format_zip321(&parsed).unwrap();
            assert_eq!(
                parse_zip321(&rebuilt, PaymentNetwork::Test).unwrap(),
                parsed
            );
            assert!(!serde_json::to_string(&parsed.summary())
                .unwrap()
                .contains("Hello world"));
        }
        assert_eq!(
            parse_zip321(&format!("zcash:{TEST_S}"), PaymentNetwork::Test)
                .unwrap()
                .summary()
                .total_zat,
            None
        );
    }
}
