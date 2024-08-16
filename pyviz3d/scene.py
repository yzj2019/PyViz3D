"""Scene class i.e. pointcept codebase data dict"""


class Scene:
    """build from pointcept data_dict"""

    def __init__(self, data_dict, cls):
        assert cls in ["VoxelGrid", "PointCloud", "Mesh"]
        self.data_dict = data_dict
        self.cls = cls
        self.build_scene()
        

    def get_properties(self, binary_filename):
        """
        :return: A dict conteining object properties. They are written into json and interpreted by javascript.
        """
        if self.cls == 'VoxelGrid':
            json_dict = {
                'type': 'points',
                'visible': self.visible,
                'alpha': self.alpha,
                'shading_type': self.shading_type,
                'point_size': self.point_size,
                'num_points': self.positions.shape[0],
                'binary_filename': binary_filename}
        elif self.cls == "PointCloud":
            json_dict = {
                'type': 'points',
                'visible': self.visible,
                'alpha': self.alpha,
                'shading_type': self.shading_type,
                'point_size': self.point_size,
                'num_points': self.positions.shape[0],
                'binary_filename': binary_filename}
        elif self.cls == "Mesh":
            json_dict = {
                'type': 'points',
                'visible': self.visible,
                'alpha': self.alpha,
                'shading_type': self.shading_type,
                'point_size': self.point_size,
                'num_points': self.positions.shape[0],
                'binary_filename': binary_filename}
        return json_dict


    def write_binary(self, path):
        """Write points to binary file."""
        bin_positions = self.positions.tobytes()
        bin_normals = self.normals.tobytes()
        bin_colors = self.colors.tobytes()
        with open(path, "wb") as f:
            f.write(bin_positions)
            f.write(bin_normals)
            f.write(bin_colors)


    def write_blender(self, path):
        raise NotImplementedError