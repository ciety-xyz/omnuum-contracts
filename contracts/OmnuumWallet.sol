// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

/*
    @dev
         Omnuum 의 fee 를 수령하는 비즈니스 공동 지갑
         항상 owner 들의 의견이 만장일치가 되어야 reuqest 가 승인됨.
    @purpose
         한명의 EOA 가 자금 출금을 독단적으로 하는 것을 방지하고자
         공동의 동의가 있어야만 출금이 가능하도록 합의에 의한 출금을 강제하며
         모든 Ledger 를 온체인에 기록하여 매출 자금의 투명성 확보
    @ProcedureSummary
         FeeReceived (계약이 수수료를 받아 eth 적립)
         Requested (인출하겠다는 인출 요청을 상신)
         Approved (인출 요청에 대한 공동 owner 들의 승인)
         Revoked (owner 는 승인 철회 가능)
         WithDrawn (승인 완료 후 직접 인출 시행)
    @Storyline
      1. Contract Balance 에 Fee 가 쌓인다.
         - Fee 는 두 종류가 있다.
         - Deploy 지불 금액
         - Mint 때 발생하는 수수료
      1. Approval Request [자금 출금 허가 요청]
         - 자금 출금을 받기로 한 EOA 가 온체인에 approval Request 를 요청한다.
         - Approval Request 에는 요청자 (msg.sender) 와 요청 금액 (withdrawal value) 이 포함된다.
         - 즉, 누구에게 얼마를 인출해 주세요. 라는 요청 문서 (transaction 데이터) 를 온체인에 기록한다.@author
      2. Approve [자금 출금 허가 승인]
         - 공동 소유주들이 자금 출금 승인을 온체인에 기록한다. (approval)
         - 공동 소유주들은 자신의 승인에 대한 결정을 번복할 수 있다. (revoke)
      3. Withdrawal [자금 인출 시행]
         - Approval request 를 한 자를 제외한 나머지 공동 owner 들의 만장일치 승인이 된 경우 자금 인출 시행이 가능하다.
         - 자금 인출은 Approval request 를 한 자만 가능하며 직접 시행해서 인출하여 transaction 기록을 남긴다.
    @Security
      1. Approval Request
         - 공동 owner 들 중에서만 자금 인출 요청을 진행할 수 있다.
         - 요청 금액은 현재의 balance 를 넘지 못한다. (안전을 위해 총 balance 의 몇 퍼센트까지만 인출을 할 수 있도록 제약을 걸 수도 있지만 불편할 것 같음)
         - 공동 owner 가 아닌 다른 계정으로 인출하는 요청을 올릴 수는 없다.
      2. Approve
         - 공동 owner 들만 승인이 가능하다.
      3. Revoke
         - 공동 owner 들만 승인 취소가 가능하다.
         - 본인이 승인한 것에 대해서만 취소가 가능하다.
      4. Withdrawal
         - 최소 승인자 수 이상으로 공동 owner 들의 승인이 이루어져야 인출이 가능하다.
         - 승인이 완료되었다면, 요청을 올린 본인만 출금이 가능하다. (인출 요청자 == 인출자)
         - 한번 출금 완료된 요청건은 재출금이 불가능하다.
         - 수명: 시작 => 요청 1건 - 승인 완료 - 출금 1건 => 끝
*/

import '@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol';

contract OmnuumWallet {
    using AddressUpgradeable for address;
    using AddressUpgradeable for address payable;

    // =========== EVENTs =========== //
    event FeeReceived(
        address indexed nftContract,
        address indexed sender,
        uint256 value
    );
    event Requested(uint256 indexed reqId, address indexed requester);
    event Approved(uint256 indexed reqId, address indexed owner);
    event Revoked(uint256 indexed reqId, address indexed owner);
    event Withdrawn(
        uint256 indexed reqId,
        address indexed receiver,
        uint256 value
    );

    // =========== STORAGEs =========== //
    uint256 public minAgreeNo; //당사자들끼리 과반수로 할지, 만장일치로 할지, 특성 수 이상으로 동의를 하게 할지 컨트랙 배포 전 결정
    address[] public owners; //공동 소유 오너들
    mapping(address => bool) public isOwner; //오너주소 => 오너여부
    mapping(uint256 => mapping(address => bool)) approvals; //reqId => 주소 => 승인 여부
    struct Request {
        address destination;
        uint256 value;
        bool withdrawn;
    } //인출 EOA 주소, 인출 금액, 인출 여부
    Request[] public requests;

    // =========== MODIFIERs =========== //
    modifier onlyOwners() {
        require(isOwner[msg.sender], 'Only Owner is permitted');
        _;
    }
    modifier reqExists(uint256 _id) {
        require(_id < requests.length, 'transaction does not exist');
        _;
    }
    modifier notApproved(uint256 _id) {
        require(!approvals[_id][msg.sender], 'owner already approved');
        _;
    }
    modifier isApproved(uint256 _id) {
        require(approvals[_id][msg.sender], 'owner already not approved');
        _;
    }
    modifier notWithdrawn(uint256 _id) {
        require(!requests[_id].withdrawn, 'transaction already withdrawn');
        _;
    }
    modifier isAllAgreed(uint256 _id) {
        require(
            getApprovalCount(_id) == owners.length,
            'Unanimous consensus is not yet reached'
        );
        _;
    }

    // =========== CONSTRUCTOR =========== //
    constructor(address[] memory _owners) {
        //minimum 2 owners are required for multi sig wallet
        require(_owners.length > 1, 'Multiple wallet owners are required');

        //Register owners
        for (uint256 i; i < _owners.length; i++) {
            address owner = _owners[i];
            require(!isOwner[owner], 'Owner already exists');
            require(!owner.isContract(), 'owner must be EOA');
            require(owner != address(0), 'Invalid owner address');

            isOwner[owner] = true;
            owners.push(owner);
        }
    }

    // =========== FEE RECEIVER =========== //
    fallback() external payable {
        // msg.data will be address for NFT proxy contract
        address nftContract;
        bytes memory _data;
        assembly {
            nftContract := mload(add(_data, 20))
        }
        emit FeeReceived(nftContract, msg.sender, msg.value);
    }

    receive() external payable {
        emit FeeReceived(address(0), msg.sender, msg.value);
    }

    // =========== WALLET LOGICs =========== //
    // === 인출 요청 === //
    function approvalRequest(uint256 _withdrawalValue)
        external
        onlyOwners
        returns (uint256)
    {
        require(
            _withdrawalValue <= address(this).balance,
            'Withdrawal value cannot exceed the balance'
        );

        //Register owner request to requests array
        requests.push(
            Request({
                destination: msg.sender,
                value: _withdrawalValue,
                withdrawn: false
            })
        );

        uint256 reqId = requests.length - 1;

        //msg.sender self-approval
        approve(reqId);

        emit Requested(reqId, msg.sender);
        return reqId;
    }

    function approve(uint256 _reqId)
        public
        onlyOwners
        reqExists(_reqId)
        notApproved(_reqId)
        notWithdrawn(_reqId)
    {
        approvals[_reqId][msg.sender] = true;
        emit Approved(_reqId, msg.sender);
    }

    function checkApproval(uint256 _reqId, address _approver)
        public
        view
        returns (bool)
    {
        return approvals[_reqId][_approver];
    }

    function getApprovalCount(uint256 _reqId) public view returns (uint256) {
        uint256 count;
        for (uint256 i; i < owners.length; i++) {
            if (checkApproval(_reqId, owners[i])) {
                count++;
            }
        }
        return count;
    }

    function withdrawal(uint256 _reqId)
        external
        onlyOwners
        reqExists(_reqId)
        notWithdrawn(_reqId)
        isAllAgreed(_reqId)
    {
        Request storage request = requests[_reqId];
        require(
            msg.sender == request.destination,
            'Withdrawer must be the requester'
        );
        request.withdrawn = true;
        payable(request.destination).sendValue(request.value);
        emit Withdrawn(_reqId, request.destination, request.value);
    }

    function revokeApproval(uint256 _reqId)
        external
        onlyOwners
        reqExists(_reqId)
        isApproved(_reqId)
        notWithdrawn(_reqId)
    {
        approvals[_reqId][msg.sender] = false;
        emit Revoked(_reqId, msg.sender);
    }

    /*
    TODO - 고민해 볼 것
    1. 합의로 특정 오너를 ban out 시키는 기능 필요
    2. 오너 추가? 교체? 제거?
    */
}
