"""Main application entry point."""

from app.randomise import (
    Randomiser,
    Hasher,
    Distribution,
    Bucketing,
    HashAlgorithm,
    DistributionMethod
)


def main():
    """Main function to demonstrate the randomisation system."""
    print("=== Randomisation System Demo ===\n")
    
    # Example 1: Simple A/B test (50/50 split)
    print("Example 1: A/B Test (50/50 split)")
    print("-" * 40)
    
    randomiser = Randomiser(
        seed="my-experiment-seed",
        proportions=[0.5, 0.5],
        table_size=100,
        hash_algorithm=HashAlgorithm.MD5,
        distribution_method=DistributionMethod.MODULUS
    )
    
    test_users = ["user1", "user2", "user3", "user4", "user5"]
    
    for user_id in test_users:
        bucket = randomiser.assign(user_id)
        variant = "A" if bucket == 0 else "B"
        print(f"  {user_id} -> Bucket {bucket} (Variant {variant})")
    
    print()
    
    # Example 2: A/B/C test with different proportions
    print("Example 2: A/B/C Test (50/30/20 split)")
    print("-" * 40)
    
    randomiser_abc = Randomiser(
        seed="multi-variant-test",
        proportions=[0.5, 0.3, 0.2],
        table_size=100,
        hash_algorithm=HashAlgorithm.SHA256,
        distribution_method=DistributionMethod.MAD
    )
    
    for user_id in test_users:
        details = randomiser_abc.assign_with_details(user_id)
        variant = chr(65 + details['bucket'])  # Convert 0,1,2 to A,B,C
        print(f"  {user_id} -> Hash: {details['hash']}, "
              f"Index: {details['index']}, "
              f"Bucket: {details['bucket']} (Variant {variant})")
    
    print()
    
    # Example 3: Demonstrate determinism
    print("Example 3: Determinism Test")
    print("-" * 40)
    print("Running assignment 3 times for 'user1':")
    
    for i in range(3):
        bucket = randomiser.assign("user1")
        print(f"  Run {i+1}: Bucket {bucket}")
    
    print("\n✓ Same user always gets same bucket (deterministic)")
    
    print()
    
    # Example 4: Component-by-component usage
    print("Example 4: Step-by-step Process")
    print("-" * 40)
    
    hasher = Hasher("my-seed", HashAlgorithm.MD5)
    distribution = Distribution(100, DistributionMethod.MODULUS)
    bucketing = Bucketing([0.5, 0.5], 100)
    
    user_id = "user123"
    
    hash_value = hasher.hash(user_id)
    print(f"  Step 1 - Hash '{user_id}': {hash_value}")
    
    index = distribution.distribute(hash_value)
    print(f"  Step 2 - Distribute to index: {index}")
    
    bucket = bucketing.get_bucket(index)
    print(f"  Step 3 - Assign to bucket: {bucket}")
    
    print("\n=== Demo Complete ===")


if __name__ == "__main__":
    main()
